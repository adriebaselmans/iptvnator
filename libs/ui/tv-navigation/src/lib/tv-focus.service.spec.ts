import { TestBed } from '@angular/core/testing';
import { TvFocusService } from './tv-focus.service';

describe('TvFocusService', () => {
    let service: TvFocusService;
    const containers = new Map<string, HTMLElement>();

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(TvFocusService);
    });

    afterEach(() => {
        for (const container of containers.values()) {
            container.remove();
        }
        containers.clear();
    });

    function containerFor(groupId: string): HTMLElement {
        let container = containers.get(groupId);
        if (!container) {
            container = document.createElement('div');
            document.body.appendChild(container);
            containers.set(groupId, container);
        }
        return container;
    }

    function registerGroup(
        id: string,
        options: {
            orientation?: 'row' | 'column' | 'grid';
            columnCount?: number;
            neighbours?: Record<string, string>;
        } = {}
    ): void {
        service.registerGroup({
            id,
            orientation: () => options.orientation ?? 'row',
            columnCount: () => options.columnCount ?? 1,
            neighbours: () => options.neighbours ?? {},
            host: containerFor(id),
        });
    }

    /** Flushes the MutationObserver microtask queue jsdom delivers records on. */
    async function flushMutations(): Promise<void> {
        await Promise.resolve();
        await Promise.resolve();
    }

    /** Registers one item, appended to the end of the group's DOM container. */
    function registerItem(groupId: string): symbol {
        const token = Symbol(`${groupId}-item`);
        const element = document.createElement('div');
        containerFor(groupId).appendChild(element);
        service.registerItem(groupId, token, element);
        return token;
    }

    /** Registers one item at a specific DOM position within the group's container. */
    function registerItemAt(groupId: string, domPosition: number): symbol {
        const token = Symbol(`${groupId}-item-at-${domPosition}`);
        const element = document.createElement('div');
        const container = containerFor(groupId);
        const referenceNode = container.children[domPosition] ?? null;
        container.insertBefore(element, referenceNode);
        service.registerItem(groupId, token, element);
        return token;
    }

    function registerItems(groupId: string, count: number): symbol[] {
        const tokens: symbol[] = [];
        for (let i = 0; i < count; i++) {
            tokens.push(registerItem(groupId));
        }
        return tokens;
    }

    it('has no active group before anything is focused', () => {
        expect(service.activeGroupId()).toBeNull();
        expect(service.activeIndex()).toBe(0);
    });

    it('setActive is a no-op for an unregistered group', () => {
        service.setActive('missing', 0);
        expect(service.activeGroupId()).toBeNull();
    });

    it('setActive focuses a registered group at the given index', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);

        service.setActive('row-a', 1);

        expect(service.activeGroupId()).toBe('row-a');
        expect(service.activeIndex()).toBe(1);
    });

    it('itemIndex reflects DOM order and updates after unregistration', () => {
        registerGroup('row-a');
        const [first, second, third] = registerItems('row-a', 3);

        expect(service.itemIndex('row-a', first)).toBe(0);
        expect(service.itemIndex('row-a', second)).toBe(1);
        expect(service.itemIndex('row-a', third)).toBe(2);

        service.unregisterItem('row-a', first);

        expect(service.itemIndex('row-a', second)).toBe(0);
        expect(service.itemIndex('row-a', third)).toBe(1);
        expect(service.itemIndex('row-a', first)).toBe(-1);
    });

    it('items registering out of DOM order still navigate in DOM order', () => {
        // Register the visually-third element FIRST, then the first, then the
        // second — arrival order is [c, a, b], but DOM order is [a, b, c].
        registerGroup('row-a');
        const container = containerFor('row-a');
        const elementA = document.createElement('div');
        const elementB = document.createElement('div');
        const elementC = document.createElement('div');
        container.append(elementA, elementB, elementC);

        const tokenC = Symbol('c');
        const tokenA = Symbol('a');
        const tokenB = Symbol('b');
        service.registerItem('row-a', tokenC, elementC);
        service.registerItem('row-a', tokenA, elementA);
        service.registerItem('row-a', tokenB, elementB);

        expect(service.itemIndex('row-a', tokenA)).toBe(0);
        expect(service.itemIndex('row-a', tokenB)).toBe(1);
        expect(service.itemIndex('row-a', tokenC)).toBe(2);

        // Moving right from the DOM-first item reaches the DOM-second item,
        // not whichever item merely registered second.
        service.setActive('row-a', 0);
        service.move('right');
        expect(service.activeIndex()).toBe(1);
        expect(service.itemIndex('row-a', tokenB)).toBe(service.activeIndex());
    });

    it('a mid-list DOM insertion is reachable at its rendered position', () => {
        registerGroup('row-a');
        const items = registerItems('row-a', 3); // DOM: [first, mid, third]
        const third = items[2];

        // Insert a new element between the first and second existing items —
        // this simulates a search-results re-render where Angular's `@for`
        // moves DOM nodes without re-running ngOnInit on the movers.
        const inserted = registerItemAt('row-a', 1);

        // DOM order is now [first, inserted, mid, third].
        expect(service.itemIndex('row-a', inserted)).toBe(1);
        expect(service.itemIndex('row-a', third)).toBe(3);

        service.setActive('row-a', 0);
        service.move('right');

        expect(service.activeIndex()).toBe(1);
        expect(service.itemIndex('row-a', inserted)).toBe(
            service.activeIndex()
        );
    });

    describe('DOM relocation of an already-registered item', () => {
        // Simulates Angular's `@for` with `track` REUSING a view whose id
        // survives into a new list: the DOM node is moved without
        // `ngOnInit` re-running, so `insertByDocumentPosition` (registration
        // time only) never sees it. This is the gap correction #15 covers —
        // distinct from the mid-list-insertion test above, which only ever
        // registers a brand-new element.

        it('is navigated in its new position after the DOM node is moved without re-registering', async () => {
            registerGroup('row-a');
            const [first, second, third] = registerItems('row-a', 3);
            const container = containerFor('row-a');

            // Relocate the DOM-first element to the end — no register/unregister
            // call accompanies the move, exactly like a reused `@for` view.
            const firstElement = container.children[0];
            container.appendChild(firstElement);
            // DOM order is now [second, third, first].

            await flushMutations();

            expect(service.itemIndex('row-a', second)).toBe(0);
            expect(service.itemIndex('row-a', third)).toBe(1);
            expect(service.itemIndex('row-a', first)).toBe(2);

            service.setActive('row-a', 0);
            service.move('right');
            expect(service.itemIndex('row-a', third)).toBe(
                service.activeIndex()
            );
        });

        it('resolves a reorder of several items at once', async () => {
            registerGroup('row-a');
            const [a, b, c, d] = registerItems('row-a', 4);
            const container = containerFor('row-a');

            // Reverse the DOM order entirely: [a, b, c, d] -> [d, c, b, a].
            const [elA, elB, elC, elD] = Array.from(container.children);
            container.appendChild(elD);
            container.appendChild(elC);
            container.appendChild(elB);
            container.appendChild(elA);

            await flushMutations();

            expect(service.itemIndex('row-a', d)).toBe(0);
            expect(service.itemIndex('row-a', c)).toBe(1);
            expect(service.itemIndex('row-a', b)).toBe(2);
            expect(service.itemIndex('row-a', a)).toBe(3);
        });

        it('removal and re-insertion still behave correctly', async () => {
            registerGroup('row-a');
            const [first, second, third] = registerItems('row-a', 3);
            const container = containerFor('row-a');

            service.unregisterItem('row-a', second);
            container.children[1].remove(); // was `second`'s element
            await flushMutations();

            expect(service.itemIndex('row-a', first)).toBe(0);
            expect(service.itemIndex('row-a', third)).toBe(1);

            const reinserted = registerItemAt('row-a', 1);
            await flushMutations();

            expect(service.itemIndex('row-a', first)).toBe(0);
            expect(service.itemIndex('row-a', reinserted)).toBe(1);
            expect(service.itemIndex('row-a', third)).toBe(2);
        });

        it('disconnects its observer on group teardown — no leaked observers', () => {
            const disconnectSpy = jest.spyOn(
                MutationObserver.prototype,
                'disconnect'
            );

            registerGroup('row-a');
            registerItems('row-a', 2);

            service.unregisterGroup('row-a');

            expect(disconnectSpy).toHaveBeenCalledTimes(1);
            disconnectSpy.mockRestore();
        });

        it('a later DOM mutation on a torn-down group is inert', async () => {
            registerGroup('row-a');
            const [first, second] = registerItems('row-a', 2);
            const container = containerFor('row-a');

            service.unregisterGroup('row-a');

            // If the observer were still attached, mutating the now-detached
            // container must not throw or resurrect the unregistered group.
            const firstElement = container.children[0];
            expect(() => {
                container.appendChild(firstElement);
            }).not.toThrow();
            await flushMutations();

            expect(service.itemIndex('row-a', first)).toBe(-1);
            expect(service.itemIndex('row-a', second)).toBe(-1);
        });
    });

    it('the common append path performs a bounded number of comparisons, not a full re-sort', () => {
        const compareSpy = jest.spyOn(
            Element.prototype,
            'compareDocumentPosition'
        );

        registerGroup('row-a');
        const itemCount = 50;
        registerItems('row-a', itemCount); // all appended in DOM order

        // A full re-sort per registration is O(n^2 log n) comparisons; with
        // insertion-by-position, each append is a single comparison against
        // the current last item (the very first item has none to compare
        // against), so the total is linear in item count.
        expect(compareSpy).toHaveBeenCalledTimes(itemCount - 1);

        compareSpy.mockRestore();
    });

    it('an out-of-order insertion via binary search still lands at the correct position', () => {
        registerGroup('row-a');
        const container = containerFor('row-a');

        // 16 items appended in DOM order.
        const elements = Array.from({ length: 16 }, () =>
            document.createElement('div')
        );
        container.append(...elements);
        const tokens = elements.map((element, i) => {
            const token = Symbol(`row-a-${i}`);
            service.registerItem('row-a', token, element);
            return token;
        });

        // Insert a new element between DOM positions 6 and 7 — deep enough
        // that only a binary search (not the append fast path) finds it.
        const insertedElement = document.createElement('div');
        container.insertBefore(insertedElement, elements[7]);
        const insertedToken = Symbol('inserted');

        const compareSpy = jest.spyOn(
            Element.prototype,
            'compareDocumentPosition'
        );
        service.registerItem('row-a', insertedToken, insertedElement);

        // Bounded by a binary search over 16 items (well under a linear scan).
        expect(compareSpy.mock.calls.length).toBeLessThanOrEqual(6);
        compareSpy.mockRestore();

        expect(service.itemIndex('row-a', insertedToken)).toBe(7);
        expect(service.itemIndex('row-a', tokens[6])).toBe(6);
        expect(service.itemIndex('row-a', tokens[7])).toBe(8);
        expect(service.itemIndex('row-a', tokens[15])).toBe(16);
    });

    it('move() is a no-op when nothing is active', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);

        service.move('right');

        expect(service.activeGroupId()).toBeNull();
    });

    it('move() delegates within-group arithmetic to the pure geometry helper', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);
        service.setActive('row-a', 0);

        service.move('right');

        expect(service.activeGroupId()).toBe('row-a');
        expect(service.activeIndex()).toBe(1);
    });

    it('move() does nothing when a within-group move exits with no declared neighbour', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);
        service.setActive('row-a', 2);

        service.move('right');

        expect(service.activeGroupId()).toBe('row-a');
        expect(service.activeIndex()).toBe(2);
    });

    it('move() crosses into a declared neighbour group via the pure graph helper', () => {
        registerGroup('rail', { neighbours: { down: 'grid' } });
        registerItems('rail', 4);

        registerGroup('grid', { orientation: 'grid', columnCount: 3 });
        registerItems('grid', 9);

        service.setActive('rail', 2);

        service.move('down');

        expect(service.activeGroupId()).toBe('grid');
        // Entering a grid top row from a rail preserves the column position.
        expect(service.activeIndex()).toBe(2);
    });

    it('move() reads the current columnCount at call time, honouring a runtime resize', () => {
        let columnCount = 3;
        service.registerGroup({
            id: 'grid',
            orientation: () => 'grid',
            columnCount: () => columnCount,
            neighbours: () => ({}),
        });
        registerItems('grid', 6);
        service.setActive('grid', 1);

        service.move('down');
        expect(service.activeIndex()).toBe(4); // columnCount 3: row0 col1 -> row1 col1 (index 4)

        service.setActive('grid', 1);
        columnCount = 2;

        service.move('down');
        expect(service.activeIndex()).toBe(3); // columnCount 2: row0 col1 -> row1 col1 (index 3)
    });

    it('unregisterGroup clears the active selection if that group was active', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);
        service.setActive('row-a', 1);

        service.unregisterGroup('row-a');

        expect(service.activeGroupId()).toBeNull();
        expect(service.activeIndex()).toBe(0);
    });

    it('unregisterGroup leaves an unrelated active group untouched', () => {
        registerGroup('row-a');
        registerItems('row-a', 3);
        registerGroup('row-b');
        registerItems('row-b', 2);
        service.setActive('row-b', 1);

        service.unregisterGroup('row-a');

        expect(service.activeGroupId()).toBe('row-b');
        expect(service.activeIndex()).toBe(1);
    });

    it('move() does nothing when the declared neighbour is empty', () => {
        registerGroup('rail', { neighbours: { down: 'empty-grid' } });
        registerItems('rail', 3);
        registerGroup('empty-grid', { orientation: 'grid', columnCount: 3 });
        // No items registered for empty-grid.
        service.setActive('rail', 1);

        service.move('down');

        expect(service.activeGroupId()).toBe('rail');
        expect(service.activeIndex()).toBe(1);
    });

    describe('activeElement()', () => {
        it('is null while no group is active', () => {
            registerGroup('rail');
            registerItems('rail', 3);

            expect(service.activeElement()).toBeNull();
        });

        it('resolves the active group and index to its element', () => {
            registerGroup('rail');
            registerItems('rail', 3);
            const container = containerFor('rail');

            service.setActive('rail', 1);
            expect(service.activeElement()).toBe(container.children[1]);

            service.move('right');
            expect(service.activeElement()).toBe(container.children[2]);
        });

        it('follows the active group across a group transition', () => {
            registerGroup('rail', { neighbours: { down: 'grid' } });
            registerItems('rail', 2);
            registerGroup('grid', { orientation: 'grid', columnCount: 2 });
            registerItems('grid', 4);
            service.setActive('rail', 0);

            service.move('down');

            expect(service.activeGroupId()).toBe('grid');
            expect(service.activeElement()).toBe(
                containerFor('grid').children[service.activeIndex()]
            );
        });

        it('is null once the active group is unregistered', () => {
            registerGroup('rail');
            registerItems('rail', 2);
            service.setActive('rail', 0);

            service.unregisterGroup('rail');

            expect(service.activeElement()).toBeNull();
        });

        it('reports an element that lives outside any particular subtree', () => {
            // An overlay renders into its own container attached to the body,
            // not into the shell's subtree. The service must still resolve it.
            const overlayContainer = document.createElement('div');
            document.body.appendChild(overlayContainer);
            const overlayItem = document.createElement('button');
            overlayContainer.appendChild(overlayItem);

            registerGroup('overlay');
            service.registerItem('overlay', Symbol('overlay'), overlayItem);
            service.setActive('overlay', 0);

            expect(service.activeElement()).toBe(overlayItem);

            overlayContainer.remove();
        });
    });
});
