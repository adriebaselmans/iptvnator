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
 * `generation` is folded into the emitted id — see `toTvSearchResultItems`
 * for why that is load-bearing, not decorative.
 */
export function toTvSearchResultItem(
    item: TvSearchSourceItem,
    playlistId: string,
    generation: number
): TvSearchResultItem | null {
    const itemId = item.xtream_id ?? item.id;
    if (itemId === undefined || !item.title) {
        return null;
    }

    return {
        id: `${generation}:${itemId}`,
        title: item.title,
        posterUrl: item.poster_url,
        route: buildRoute(playlistId, item.type, itemId),
    };
}

/**
 * Maps a full result set, scoping every item's id to `generation` — a
 * counter the caller bumps once per completed search (see
 * `TvSearchScreenComponent.results`).
 *
 * This is a real fix for a real gap, not decoration: `TvFocusService`
 * orders a group's items by DOM position, but only AT REGISTRATION time
 * (`insertByDocumentPosition`, run from `TvFocusableDirective.ngOnInit`).
 * When two consecutive result sets share an id, Angular's `@for` REUSES
 * that view and MOVES its DOM node to the new position — without
 * re-running `ngOnInit` — so the focus group's cached position for that
 * item goes stale relative to where it now actually sits. Scoping every
 * id to the search generation guarantees no id survives across a result
 * set change, so `@for` destroys and recreates every card on each new
 * search, `ngOnInit` genuinely reruns, and registration order is real DOM
 * order again. Confirmed to reproduce without this: two result sets
 * sharing an id in a different position left the focus group's recorded
 * order stale. §6.2 anticipated the general hazard ("search results
 * updating per keystroke" are called out by name) but its stated fix
 * (order-by-insertion) does not cover a reused-and-moved node, only a
 * freshly-registered or removed one — that gap is the thing this works
 * around, in the screen, because `libs/ui/tv-navigation` is out of bounds
 * to modify (§5.5).
 */
export function toTvSearchResultItems(
    items: readonly TvSearchSourceItem[],
    playlistId: string,
    generation: number
): TvSearchResultItem[] {
    const mapped: TvSearchResultItem[] = [];
    for (const item of items) {
        const entry = toTvSearchResultItem(item, playlistId, generation);
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
