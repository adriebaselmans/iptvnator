/**
 * Pure, DOM-free index arithmetic for the TV shell's focus groups.
 *
 * A focus group is a known-structure layout — a single row, a single
 * column, or a fixed-column grid — so "what should receive focus next" is a
 * deterministic index computation, not a spatial search over rendered DOM
 * geometry. No function here touches Angular, the DOM, or any global state.
 */

/** How items are laid out within a single focus group. */
export type FocusOrientation = 'row' | 'column' | 'grid';

/** The four directions the six-key remote vocabulary can produce. */
export type FocusDirection = 'up' | 'down' | 'left' | 'right';

/** Input to {@link computeNextFocusIndex}. */
export interface FocusMoveRequest {
    /** The currently focused index within the group, 0-based. */
    readonly currentIndex: number;
    /** Total number of focusable items currently in the group. */
    readonly itemCount: number;
    readonly orientation: FocusOrientation;
    readonly direction: FocusDirection;
    /**
     * Number of columns for a `grid` orientation. Ignored for `row`/`column`.
     * Supplied at call time (never hard-coded) because it is derived from the
     * viewport and can change on resize.
     */
    readonly columnCount?: number;
}

/**
 * The result of a move: either a new index within the same group, or an
 * explicit signal that the move exits the group in the given direction. The
 * caller (the focus graph / service) decides what happens on exit — this
 * module never clamps a move it cannot fulfil into a fake "stayed" index.
 */
export type FocusMoveResult =
    | { readonly kind: 'moved'; readonly index: number }
    | { readonly kind: 'exit'; readonly direction: FocusDirection };

function moved(index: number): FocusMoveResult {
    return { kind: 'moved', index };
}

function exit(direction: FocusDirection): FocusMoveResult {
    return { kind: 'exit', direction };
}

/** Computes the next focus index for a group, or reports that the move exits it. */
export function computeNextFocusIndex(
    request: FocusMoveRequest
): FocusMoveResult {
    const { currentIndex, itemCount, orientation, direction } = request;

    // An empty group has nothing to move to; every direction exits it.
    if (itemCount <= 0) {
        return exit(direction);
    }

    switch (orientation) {
        case 'row':
            return computeRowMove(currentIndex, itemCount, direction);
        case 'column':
            return computeColumnMove(currentIndex, itemCount, direction);
        case 'grid':
            return computeGridMove(
                currentIndex,
                itemCount,
                direction,
                normalizeColumnCount(request.columnCount, itemCount)
            );
    }
}

/** A grid with no usable column count degrades to a single row of `itemCount`. */
function normalizeColumnCount(
    columnCount: number | undefined,
    itemCount: number
): number {
    if (!columnCount || columnCount < 1) {
        return Math.max(itemCount, 1);
    }
    return Math.floor(columnCount);
}

function computeRowMove(
    currentIndex: number,
    itemCount: number,
    direction: FocusDirection
): FocusMoveResult {
    switch (direction) {
        case 'left':
            return currentIndex > 0 ? moved(currentIndex - 1) : exit('left');
        case 'right':
            return currentIndex < itemCount - 1
                ? moved(currentIndex + 1)
                : exit('right');
        case 'up':
        case 'down':
            // A row has no vertical structure; up/down always leave it.
            return exit(direction);
    }
}

function computeColumnMove(
    currentIndex: number,
    itemCount: number,
    direction: FocusDirection
): FocusMoveResult {
    switch (direction) {
        case 'up':
            return currentIndex > 0 ? moved(currentIndex - 1) : exit('up');
        case 'down':
            return currentIndex < itemCount - 1
                ? moved(currentIndex + 1)
                : exit('down');
        case 'left':
        case 'right':
            // A column has no horizontal structure; left/right always leave it.
            return exit(direction);
    }
}

function computeGridMove(
    currentIndex: number,
    itemCount: number,
    direction: FocusDirection,
    columnCount: number
): FocusMoveResult {
    const columnIndex = currentIndex % columnCount;

    switch (direction) {
        case 'left':
            return columnIndex > 0 ? moved(currentIndex - 1) : exit('left');
        case 'right': {
            // Never wrap across a row edge, even if the next raw index exists
            // (it would belong to the next row).
            const atRowEnd = columnIndex === columnCount - 1;
            const next = currentIndex + 1;
            return !atRowEnd && next < itemCount ? moved(next) : exit('right');
        }
        case 'up': {
            const prev = currentIndex - columnCount;
            // Rows above the current one are always full, so a non-negative
            // prev index is always a real item.
            return prev >= 0 ? moved(prev) : exit('up');
        }
        case 'down':
            return computeGridDown(currentIndex, itemCount, columnCount, columnIndex);
    }
}

/**
 * Moving down a full column normally lands `columnCount` items later. The
 * last row is usually partial, so that target may not exist even though a
 * next row does — in that case land on the last existing item instead of an
 * out-of-range index. Only when there is no next row at all does the move
 * exit the group.
 */
function computeGridDown(
    currentIndex: number,
    itemCount: number,
    columnCount: number,
    columnIndex: number
): FocusMoveResult {
    const next = currentIndex + columnCount;
    if (next < itemCount) {
        return moved(next);
    }

    const nextRowStart = currentIndex - columnIndex + columnCount;
    if (nextRowStart >= itemCount) {
        return exit('down');
    }

    return moved(itemCount - 1);
}
