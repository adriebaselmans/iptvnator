import type { TvPosterGridItem } from '@iptvnator/workspace/tv-shell/ui';

/** The subset of `XtreamSearchResultItem` a result card needs. */
export interface TvSearchSourceItem {
    readonly xtream_id?: string | number;
    readonly id?: string | number;
    readonly title: string;
    readonly type: string;
    readonly poster_url?: string;
}

export interface TvSearchResultItem extends TvPosterGridItem {
    readonly route: readonly string[];
}

function buildRoute(
    playlistId: string,
    type: string,
    itemId: string | number
): readonly string[] {
    if (type === 'live') {
        return ['/tv', 'xtreams', playlistId, 'live'];
    }
    const detailType = type === 'series' ? 'series' : 'movie';
    return ['/tv', 'xtreams', playlistId, 'detail', detailType, String(itemId)];
}

/**
 * Maps one search result to the results grid's item shape (§7.6). Search
 * results are a store-owned `XtreamSearchResultItem` — the same field
 * ambiguity the desktop search view resolves (`xtream_id` for API results,
 * `id` as a fallback) — mirrored here rather than imported, since this
 * screen only needs id/title/poster, not the full desktop search contract.
 *
 * The emitted id is the plain source id, unscoped. An earlier version of
 * this function scoped it to a per-search generation counter to force
 * Angular's `@for` to recreate every card on each new query — a workaround
 * for `TvFocusService` only ordering items by DOM position at registration
 * time. That primitive now re-derives order on DOM mutation too (a
 * `MutationObserver` on the group host), so a reused-and-moved view is
 * ordered correctly without recreation; see `libs/ui/tv-navigation`'s
 * `TvFocusService`.
 */
export function toTvSearchResultItem(
    item: TvSearchSourceItem,
    playlistId: string
): TvSearchResultItem | null {
    const itemId = item.xtream_id ?? item.id;
    if (itemId === undefined || !item.title) {
        return null;
    }

    return {
        id: itemId,
        title: item.title,
        posterUrl: item.poster_url,
        route: buildRoute(playlistId, item.type, itemId),
    };
}

/** Maps a full result set to the results grid's item shape. */
export function toTvSearchResultItems(
    items: readonly TvSearchSourceItem[],
    playlistId: string
): TvSearchResultItem[] {
    const mapped: TvSearchResultItem[] = [];
    for (const item of items) {
        const entry = toTvSearchResultItem(item, playlistId);
        if (entry) mapped.push(entry);
    }
    return mapped;
}

/** Backspace drops the last character; anything else appends verbatim. */
export function applyTvKeyboardChar(current: string, char: string): string {
    return current + char;
}

export function applyTvKeyboardBackspace(current: string): string {
    return current.slice(0, -1);
}

/** The store's own minimum before a query is worth sending (mirrors the desktop in-portal search). */
export const TV_SEARCH_MIN_QUERY_LENGTH = 3;

export const TV_SEARCH_TYPES: readonly string[] = ['live', 'movie', 'series'];
