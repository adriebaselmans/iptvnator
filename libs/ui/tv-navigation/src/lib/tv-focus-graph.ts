/**
 * Pure, DOM-free resolution of group-to-group focus transitions.
 *
 * When a move exits a {@link FocusOrientation} group's bounds (see
 * `tv-focus-geometry.ts`), a screen's declared neighbour map decides which
 * group receives focus next, and this module decides where in that group
 * focus should land — preserving the perpendicular position where it is
 * meaningful (e.g. leaving a grid upward into a rail keeps the horizontal
 * position instead of always landing on index 0).
 */

import type { FocusDirection, FocusOrientation } from './tv-focus-geometry';

/** Declares, per direction, the id of the neighbouring group (if any). */
export interface FocusGroupNeighbours {
    readonly up?: string;
    readonly down?: string;
    readonly left?: string;
    readonly right?: string;
}

/** Everything the graph needs to know about a group to resolve a transition. */
export interface FocusGroupDescriptor {
    readonly id: string;
    readonly orientation: FocusOrientation;
    readonly itemCount: number;
    readonly columnCount?: number;
    readonly neighbours: FocusGroupNeighbours;
}

/** Where focus should land after a group-to-group transition. */
export interface FocusGroupTarget {
    readonly groupId: string;
    readonly index: number;
}

/**
 * Resolves the destination group and entry index for a move that exited
 * `source` in `direction`. Returns `null` when there is no destination —
 * either no neighbour is declared, or the neighbour is empty — meaning
 * focus stays exactly where it was.
 */
export function resolveGroupExit(
    source: FocusGroupDescriptor,
    exitIndex: number,
    direction: FocusDirection,
    destination: FocusGroupDescriptor | undefined
): FocusGroupTarget | null {
    if (!destination || destination.itemCount <= 0) {
        return null;
    }

    const crossPosition = computeCrossPosition(source, exitIndex, direction);
    const index = computeEntryIndex(destination, direction, crossPosition);

    return { groupId: destination.id, index };
}

/**
 * The position along the axis perpendicular to the exit direction — the
 * coordinate that should be preserved when entering the destination group.
 */
function computeCrossPosition(
    source: FocusGroupDescriptor,
    exitIndex: number,
    direction: FocusDirection
): number {
    const columnCount = normalizedColumnCount(source);

    if (direction === 'up' || direction === 'down') {
        // Exiting vertically: preserve horizontal position.
        return source.orientation === 'grid'
            ? exitIndex % columnCount
            : exitIndex;
    }

    // Exiting horizontally: preserve vertical position.
    return source.orientation === 'grid'
        ? Math.floor(exitIndex / columnCount)
        : exitIndex;
}

function computeEntryIndex(
    destination: FocusGroupDescriptor,
    direction: FocusDirection,
    crossPosition: number
): number {
    return direction === 'up' || direction === 'down'
        ? computeVerticalEntry(destination, direction, crossPosition)
        : computeHorizontalEntry(destination, direction, crossPosition);
}

/** Entering a destination group after a vertical (up/down) exit. */
function computeVerticalEntry(
    destination: FocusGroupDescriptor,
    direction: FocusDirection,
    crossPosition: number
): number {
    switch (destination.orientation) {
        case 'row':
            // A row is one horizontal strip: the cross position maps directly.
            return clamp(crossPosition, 0, destination.itemCount - 1);
        case 'column':
            // Enter at the edge nearest the group we came from.
            return direction === 'up' ? destination.itemCount - 1 : 0;
        case 'grid': {
            const columnCount = normalizedColumnCount(destination);
            const rowIndex =
                direction === 'up'
                    ? lastRowIndex(destination.itemCount, columnCount)
                    : 0;
            return entryInRow(
                destination.itemCount,
                columnCount,
                rowIndex,
                crossPosition
            );
        }
    }
}

/** Entering a destination group after a horizontal (left/right) exit. */
function computeHorizontalEntry(
    destination: FocusGroupDescriptor,
    direction: FocusDirection,
    crossPosition: number
): number {
    switch (destination.orientation) {
        case 'column':
            // A column is one vertical strip: the cross position maps directly.
            return clamp(crossPosition, 0, destination.itemCount - 1);
        case 'row':
            // Enter at the edge nearest the group we came from.
            return direction === 'left' ? destination.itemCount - 1 : 0;
        case 'grid': {
            const columnCount = normalizedColumnCount(destination);
            const totalRows = lastRowIndex(destination.itemCount, columnCount) + 1;
            const rowIndex = clamp(crossPosition, 0, totalRows - 1);
            const length = rowLength(destination.itemCount, columnCount, rowIndex);
            const columnIndex = direction === 'left' ? length - 1 : 0;
            return rowIndex * columnCount + columnIndex;
        }
    }
}

/** Clamps a column position into an existing row, honouring a partial final row. */
function entryInRow(
    itemCount: number,
    columnCount: number,
    rowIndex: number,
    crossPosition: number
): number {
    const length = rowLength(itemCount, columnCount, rowIndex);
    const columnIndex = clamp(crossPosition, 0, length - 1);
    return rowIndex * columnCount + columnIndex;
}

/** Number of items actually present in a grid row (the last row may be partial). */
function rowLength(
    itemCount: number,
    columnCount: number,
    rowIndex: number
): number {
    const start = rowIndex * columnCount;
    return Math.min(columnCount, Math.max(itemCount - start, 0));
}

function lastRowIndex(itemCount: number, columnCount: number): number {
    return Math.floor((itemCount - 1) / columnCount);
}

/** A non-grid group behaves as a single row of its own length for this math. */
function normalizedColumnCount(group: FocusGroupDescriptor): number {
    if (group.orientation !== 'grid') {
        return Math.max(group.itemCount, 1);
    }
    if (!group.columnCount || group.columnCount < 1) {
        return Math.max(group.itemCount, 1);
    }
    return Math.floor(group.columnCount);
}

function clamp(value: number, min: number, max: number): number {
    if (max < min) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
