import type { TvCategoryRailItem, TvPosterGridItem } from '@iptvnator/workspace/tv-shell/ui';
import type { XtreamPlaylistData } from '@iptvnator/portal/xtream/data-access';
import type { ContentType } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';

/** `/tv/xtreams/:id/movies` and `/tv/xtreams/:id/series` both route through this screen (§7.4). */
export type TvCatalogContentType = Extract<ContentType, 'vod' | 'series'>;

/** The detail route's `:type` segment (§5.2 route table). */
export type TvCatalogDetailType = 'movie' | 'series';

export function toTvCatalogDetailType(
    contentType: TvCatalogContentType
): TvCatalogDetailType {
    return contentType === 'vod' ? 'movie' : 'series';
}

interface RawXtreamCatalogItem {
    readonly [key: string]: unknown;
    readonly id?: number | string;
    readonly stream_id?: number | string;
    readonly series_id?: number | string;
    readonly name?: string;
    readonly title?: string;
    readonly poster_url?: string;
    readonly cover?: string;
    readonly stream_icon?: string;
}

/**
 * Resolves a catalog item's stable identity for the detail route. Movies use
 * `stream_id`, series use `series_id` — mirrors the desktop portal's own
 * item-shape handling (`with-selection.feature.ts`).
 */
export function resolveTvCatalogItemId(
    item: RawXtreamCatalogItem
): number | string | undefined {
    return item.stream_id ?? item.series_id ?? item.id;
}

/**
 * Poster resolution priority mirrors the desktop grid
 * (`GridListComponent.resolvePoster`): an explicit `poster_url` (TMDB
 * enrichment / favorites) wins, then the series `cover`, then the VOD
 * `stream_icon`.
 */
function resolveTvCatalogPosterUrl(
    item: RawXtreamCatalogItem
): string | undefined {
    return item.poster_url || item.cover || item.stream_icon || undefined;
}

/** Maps a raw Xtream VOD/series catalog item to the poster grid's item shape. */
export function toTvPosterGridItem(
    item: RawXtreamCatalogItem
): TvPosterGridItem | null {
    const id = resolveTvCatalogItemId(item);
    const title = item.name ?? item.title;
    if (id === undefined || !title) {
        return null;
    }

    return {
        id,
        title,
        posterUrl: resolveTvCatalogPosterUrl(item),
    };
}

interface RawXtreamCategory {
    readonly category_id?: string | number;
    readonly id?: string | number;
    readonly category_name?: string;
    readonly name?: string;
}

/**
 * Builds the category rail's item list: a leading "All" entry (id `null`,
 * matching the store's `selectedCategoryId` convention for "no category
 * filter") followed by every provider category, item counts attached from
 * the store's per-category count map.
 */
export function buildTvCategoryRailItems(
    categories: readonly RawXtreamCategory[],
    itemCounts: ReadonlyMap<number, number>,
    allLabel: string
): TvCategoryRailItem[] {
    const totalCount = categories.reduce(
        (sum, category) =>
            sum + (itemCounts.get(Number(category.category_id ?? category.id)) ?? 0),
        0
    );

    const items: TvCategoryRailItem[] = [
        { id: null, label: allLabel, count: totalCount },
    ];

    for (const category of categories) {
        const numericId = Number(category.category_id ?? category.id);
        if (Number.isNaN(numericId)) {
            continue;
        }
        items.push({
            id: numericId,
            label: category.category_name ?? category.name ?? '',
            count: itemCounts.get(numericId),
        });
    }

    return items;
}

/** Mirrors `XtreamWorkspaceRouteSession`'s playlist-meta conversion, scoped to the TV shell's own minimal bootstrap. */
export function toTvXtreamPlaylistData(
    playlist: PlaylistMeta | null | undefined
): XtreamPlaylistData | null {
    if (
        !playlist?._id ||
        !playlist.serverUrl ||
        !playlist.username ||
        !playlist.password
    ) {
        return null;
    }

    return {
        id: playlist._id,
        name: playlist.title || playlist.filename || playlist._id,
        title: playlist.title,
        updateDate: playlist.updateDate,
        serverUrl: playlist.serverUrl,
        username: playlist.username,
        password: playlist.password,
        type: 'xtream',
        ...(playlist.userAgent ? { userAgent: playlist.userAgent } : {}),
        ...(playlist.referrer ? { referrer: playlist.referrer } : {}),
        ...(playlist.origin ? { origin: playlist.origin } : {}),
    };
}
