import { Injectable, signal } from '@angular/core';
import {
    computeNextFocusIndex,
    type FocusDirection,
    type FocusOrientation,
} from './tv-focus-geometry';
import {
    resolveGroupExit,
    type FocusGroupDescriptor,
    type FocusGroupNeighbours,
} from './tv-focus-graph';

/**
 * What {@link TvFocusGroupDirective} registers for a group. Orientation,
 * column count and neighbours are read as closures rather than snapshots so
 * a group's configuration (e.g. a grid's runtime column count) can change
 * without re-registering.
 */
export interface FocusGroupRegistration {
    readonly id: string;
    readonly orientation: () => FocusOrientation;
    readonly columnCount: () => number;
    readonly neighbours: () => FocusGroupNeighbours;
}

interface RegisteredItem {
    readonly token: symbol;
    readonly element: Element;
}

interface GroupState extends FocusGroupRegistration {
    readonly items: readonly RegisteredItem[];
}

/**
 * Orders items by real document position rather than registration order.
 * Registration order is not a safe proxy for it: Angular's `@for` with
 * `track` reuses views and moves DOM nodes without re-running `ngOnInit`, so
 * a re-sorted or prepended list would leave registration order stale while
 * the rendering changed.
 */
function byDocumentPosition(a: RegisteredItem, b: RegisteredItem): number {
    if (a.element === b.element) {
        return 0;
    }
    const position = a.element.compareDocumentPosition(b.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
    }
    if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
    }
    return 0;
}

/**
 * Inserts an item at its DOM position without re-sorting the whole group.
 * The loaded window keeps growing (`loadMore`), so a full re-sort per
 * registration is O(n² log n) real `compareDocumentPosition` calls. Both
 * `@for`'s initial render and `loadMore` append in DOM order, so comparing
 * against the current last item first resolves the common case with a
 * single comparison; a binary search only runs when the item does not
 * belong at the end (e.g. a mid-list insertion).
 */
function insertByDocumentPosition(
    items: readonly RegisteredItem[],
    item: RegisteredItem
): RegisteredItem[] {
    if (items.length === 0) {
        return [item];
    }

    const last = items[items.length - 1];
    if (byDocumentPosition(last, item) <= 0) {
        return [...items, item];
    }

    const index = findInsertionIndex(items, item);
    const next = items.slice();
    next.splice(index, 0, item);
    return next;
}

/** Binary search for the first index whose item sorts after `item`. */
function findInsertionIndex(
    items: readonly RegisteredItem[],
    item: RegisteredItem
): number {
    let low = 0;
    let high = items.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (byDocumentPosition(items[mid], item) <= 0) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low;
}

/**
 * Owns the active focus group and index for the TV shell and exposes a
 * single `move()` entry point. All arithmetic is delegated to the pure
 * `tv-focus-geometry`/`tv-focus-graph` modules — this service only holds
 * the registry of groups/items and the current position.
 */
@Injectable({ providedIn: 'root' })
export class TvFocusService {
    private readonly groupsSignal = signal<ReadonlyMap<string, GroupState>>(
        new Map()
    );
    private readonly activeGroupSignal = signal<string | null>(null);
    private readonly activeIndexSignal = signal(0);

    readonly activeGroupId = this.activeGroupSignal.asReadonly();
    readonly activeIndex = this.activeIndexSignal.asReadonly();

    registerGroup(registration: FocusGroupRegistration): void {
        this.mutateGroups((groups) => {
            groups.set(registration.id, { ...registration, items: [] });
        });
    }

    unregisterGroup(id: string): void {
        this.mutateGroups((groups) => {
            groups.delete(id);
        });
        if (this.activeGroupSignal() === id) {
            this.activeGroupSignal.set(null);
            this.activeIndexSignal.set(0);
        }
    }

    registerItem(groupId: string, token: symbol, element: Element): void {
        this.mutateGroups((groups) => {
            const group = groups.get(groupId);
            if (!group) {
                return;
            }
            groups.set(groupId, {
                ...group,
                items: insertByDocumentPosition(group.items, {
                    token,
                    element,
                }),
            });
        });
    }

    unregisterItem(groupId: string, token: symbol): void {
        this.mutateGroups((groups) => {
            const group = groups.get(groupId);
            if (!group) {
                return;
            }
            groups.set(groupId, {
                ...group,
                items: group.items.filter((item) => item.token !== token),
            });
        });
    }

    /** The item's current position within its group (in DOM order), or -1 if not found. */
    itemIndex(groupId: string, token: symbol): number {
        return (
            this.groupsSignal()
                .get(groupId)
                ?.items.findIndex((item) => item.token === token) ?? -1
        );
    }

    /** Explicitly focuses an item, e.g. as a screen's initial focus. */
    setActive(groupId: string, index: number): void {
        if (!this.groupsSignal().has(groupId)) {
            return;
        }
        this.activeGroupSignal.set(groupId);
        this.activeIndexSignal.set(index);
    }

    /** Moves focus in `direction`, delegating all arithmetic to the pure helpers. */
    move(direction: FocusDirection): void {
        const groupId = this.activeGroupSignal();
        if (!groupId) {
            return;
        }
        const group = this.groupsSignal().get(groupId);
        if (!group) {
            return;
        }

        const result = computeNextFocusIndex({
            currentIndex: this.activeIndexSignal(),
            itemCount: group.items.length,
            orientation: group.orientation(),
            direction,
            columnCount: group.columnCount(),
        });

        if (result.kind === 'moved') {
            this.activeIndexSignal.set(result.index);
            return;
        }

        this.exitGroup(groupId, group, direction);
    }

    private exitGroup(
        groupId: string,
        group: GroupState,
        direction: FocusDirection
    ): void {
        const neighbourId = group.neighbours()[direction];
        const destinationGroup = neighbourId
            ? this.groupsSignal().get(neighbourId)
            : undefined;

        const target = resolveGroupExit(
            this.toDescriptor(groupId, group),
            this.activeIndexSignal(),
            direction,
            destinationGroup && neighbourId
                ? this.toDescriptor(neighbourId, destinationGroup)
                : undefined
        );

        if (!target) {
            return;
        }

        this.activeGroupSignal.set(target.groupId);
        this.activeIndexSignal.set(target.index);
    }

    private toDescriptor(id: string, group: GroupState): FocusGroupDescriptor {
        return {
            id,
            orientation: group.orientation(),
            itemCount: group.items.length,
            columnCount: group.columnCount(),
            neighbours: group.neighbours(),
        };
    }

    private mutateGroups(
        mutator: (groups: Map<string, GroupState>) => void
    ): void {
        const next = new Map(this.groupsSignal());
        mutator(next);
        this.groupsSignal.set(next);
    }
}
