/**
 * Poster card box width used by the column-count math, in CSS pixels.
 * Kept alongside the derivation so a future card-size change updates the
 * arithmetic in the same place.
 */
export const TV_GRID_CARD_WIDTH_PX = 280;

/** Gap between poster cards, in CSS pixels. */
export const TV_GRID_CARD_GAP_PX = 24;

/** The grid never collapses below this many columns, even on a narrow viewport. */
export const TV_GRID_MIN_COLUMNS = 2;

/**
 * Derives the poster grid's column count from the available container width
 * (§7.4 of the TV shell design). The focus group's index arithmetic needs the
 * ACTUAL rendered column count to be correct, so this must track the
 * viewport rather than assume a fixed value — six columns is the expected
 * result at a 1920px-wide 1080p viewport, not a constant the caller may bake
 * in instead of measuring.
 *
 * Pure and DOM-free so it is unit-testable without a browser; the caller
 * supplies the measured width (e.g. via `ResizeObserver`).
 */
export function computeTvGridColumnCount(
    containerWidthPx: number,
    cardWidthPx: number = TV_GRID_CARD_WIDTH_PX,
    gapPx: number = TV_GRID_CARD_GAP_PX,
    minColumns: number = TV_GRID_MIN_COLUMNS
): number {
    if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
        return minColumns;
    }

    const columns = Math.floor(
        (containerWidthPx + gapPx) / (cardWidthPx + gapPx)
    );

    return Math.max(minColumns, columns);
}
