import type { CatalogTitleMatch, PortalActivityType } from '@iptvnator/shared/interfaces';
import type { TvHomeRailItem } from '@iptvnator/workspace/tv-shell/ui';
import { TV_NAV_GROUP_ID } from '../nav/tv-nav-bar.util';

/** Rails shown on the home screen (§7.2), in display order. */
export type TvHomeRailKind =
    | 'continue-watching'
    | 'recently-added'
    | 'favourites'
    | 'live-now'
    | 'trending'
    | 'recommendations';

const TV_HOME_RAIL_GROUP_PREFIX = 'tv-home-rail';
export const TV_HOME_HERO_GROUP_ID = 'tv-home-hero';
/** Re-exported for the template/screen: the shared nav row's group id. */
export const TV_HOME_NAV_GROUP_ID = TV_NAV_GROUP_ID;

export function tvHomeRailGroupId(kind: TvHomeRailKind): string {
    return `${TV_HOME_RAIL_GROUP_PREFIX}-${kind}`;
}

/** How many items a rail shows — a short pre-loaded slice, never a `loadMore` window. */
export const TV_HOME_RAIL_ITEM_LIMIT = 12;

/** i18n key for a rail's heading. */
export function tvHomeRailTitleKey(kind: TvHomeRailKind): string {
    switch (kind) {
        case 'continue-watching':
            return 'TV.HOME.RAIL_CONTINUE_WATCHING';
        case 'recently-added':
            return 'TV.HOME.RAIL_RECENTLY_ADDED';
        case 'favourites':
            return 'TV.HOME.RAIL_FAVOURITES';
        case 'live-now':
            return 'TV.HOME.RAIL_LIVE_NOW';
        case 'trending':
            return 'TV.HOME.RAIL_TRENDING';
        case 'recommendations':
            return 'TV.HOME.RAIL_RECOMMENDATIONS';
    }
}

function buildTvHomeDetailRoute(
    playlistId: string,
    type: 'movie' | 'series',
    itemId: number | string
): readonly string[] {
    return ['/tv', 'xtreams', playlistId, 'detail', type, String(itemId)];
}

function buildTvHomeLiveRoute(playlistId: string): readonly string[] {
    return ['/tv', 'xtreams', playlistId, 'live'];
}

/** The subset of `PortalRecentItem`/`PortalFavoriteItem`/`PortalAddedItem` a rail card needs. */
export interface TvHomeSourceItem {
    readonly id: number | string;
    readonly title: string;
    readonly type: PortalActivityType;
    readonly playlist_id: string;
    readonly xtream_id: number | string;
    readonly poster_url?: string;
}

/** A rail item plus the router link its activation targets. */
export interface TvHomeNavigableRailItem extends TvHomeRailItem {
    readonly route: readonly string[];
}

/**
 * Maps a dashboard activity item (recent / favorite / recently-added — they
 * share the same field shape) to a home rail item, or `null` when it belongs
 * to a different playlist. Live items route to the live screen (no
 * per-channel deep link exists yet — §7.3's route table has no channel
 * param); movie/series items route to their detail page.
 */
export function toTvHomeRailItem(
    item: TvHomeSourceItem,
    playlistId: string,
    idPrefix: string
): TvHomeNavigableRailItem | null {
    if (item.playlist_id !== playlistId) {
        return null;
    }

    const id = `${idPrefix}-${item.id}`;
    if (item.type === 'live') {
        return {
            id,
            title: item.title,
            posterUrl: item.poster_url,
            kind: 'movie',
            route: buildTvHomeLiveRoute(playlistId),
        };
    }

    return {
        id,
        title: item.title,
        posterUrl: item.poster_url,
        kind: item.type,
        route: buildTvHomeDetailRoute(playlistId, item.type, item.xtream_id),
    };
}

/** The subset of `DashboardTrendingItem`/`DashboardRecommendationItem` a rail card needs. */
export interface TvHomeMatchedSourceItem {
    readonly title: string;
    readonly posterUrl: string | null;
    readonly match: CatalogTitleMatch;
}

/**
 * Maps a TMDB trending/recommendation entry — already matched against the
 * catalog — to a home rail item, or `null` when the match belongs to a
 * different playlist than the one Home is showing.
 */
export function toTvHomeMatchedRailItem(
    entry: TvHomeMatchedSourceItem,
    playlistId: string,
    idPrefix: string
): TvHomeNavigableRailItem | null {
    if (entry.match.playlistId !== playlistId) {
        return null;
    }

    return {
        id: `${idPrefix}-${entry.match.type}-${entry.match.xtreamId}`,
        title: entry.title,
        posterUrl: entry.posterUrl ?? undefined,
        kind: entry.match.type,
        route: buildTvHomeDetailRoute(
            playlistId,
            entry.match.type,
            entry.match.xtreamId
        ),
    };
}

/** The hero's source shape — a `PortalRecentItem`, movie/series only. */
export interface TvHomeHeroSourceItem {
    readonly title: string;
    readonly type: PortalActivityType;
    readonly playlist_id: string;
    readonly xtream_id: number | string;
    readonly poster_url?: string;
    readonly backdrop_url?: string;
}

export interface TvHomeHeroData {
    readonly title: string;
    readonly backdropUrl?: string;
    readonly route: readonly string[];
}

/**
 * The hero (§7.2): backdrop, title and a resume CTA for the most recently
 * watched movie/series on this playlist. Live channels never become the
 * hero — "Resume" only makes sense for VOD, and the "Live now" rail already
 * covers live. `null` when there is nothing to feature; the caller then
 * hides the hero entirely rather than rendering it empty.
 */
export function toTvHomeHero(
    item: TvHomeHeroSourceItem | undefined,
    playlistId: string
): TvHomeHeroData | null {
    if (!item || (item.type !== 'movie' && item.type !== 'series')) {
        return null;
    }

    return {
        title: item.title,
        backdropUrl: item.backdrop_url || item.poster_url,
        route: buildTvHomeDetailRoute(playlistId, item.type, item.xtream_id),
    };
}

/** Neighbour set for one group in the home screen's vertical stack. */
export interface TvHomeGroupNeighbours {
    readonly up?: string;
    readonly down?: string;
}

/**
 * Chains a list of visible group ids into an up/down neighbour map. Pure and
 * DOM-free, mirroring `tv-focus-graph.ts`'s own style — the home screen's
 * groups are conditionally rendered (only non-empty rails appear), so the
 * chain must be rebuilt from whatever is actually visible rather than a
 * fixed layout.
 */
export function buildTvHomeNeighbourChain(
    groupIds: readonly string[]
): ReadonlyMap<string, TvHomeGroupNeighbours> {
    const map = new Map<string, TvHomeGroupNeighbours>();
    groupIds.forEach((id, index) => {
        const neighbours: { up?: string; down?: string } = {};
        if (index > 0) {
            neighbours.up = groupIds[index - 1];
        }
        if (index < groupIds.length - 1) {
            neighbours.down = groupIds[index + 1];
        }
        map.set(id, neighbours);
    });
    return map;
}

/** One rail's kind and its already-mapped, already-limited items. */
export interface TvHomeRailSection {
    readonly kind: TvHomeRailKind;
    readonly items: readonly TvHomeNavigableRailItem[];
}

/** A rail with its resolved group id, i18n title key and computed neighbours. */
export interface TvHomeVisibleRail extends TvHomeRailSection {
    readonly groupId: string;
    readonly titleKey: string;
    readonly neighbours: TvHomeGroupNeighbours;
}

export interface TvHomeLayout {
    readonly navNeighbours: TvHomeGroupNeighbours;
    readonly heroNeighbours: TvHomeGroupNeighbours | null;
    readonly rails: readonly TvHomeVisibleRail[];
}

/**
 * Builds the home screen's vertical group stack: the persistent nav row
 * (design correction #18) always on top, then the hero (if present) above
 * every non-empty rail, in the order the sections were given. Absent/empty
 * rails simply do not appear — their neighbour slots are never left dangling
 * because the chain is rebuilt from exactly what is visible. The nav row is
 * unconditional (unlike the hero/rails) so Up from the topmost content group
 * always reaches it, even when nothing else is visible yet.
 */
export function buildTvHomeLayout(
    hasHero: boolean,
    sections: readonly TvHomeRailSection[]
): TvHomeLayout {
    const visible = sections.filter((section) => section.items.length > 0);
    const groupIds = [
        TV_HOME_NAV_GROUP_ID,
        ...(hasHero ? [TV_HOME_HERO_GROUP_ID] : []),
        ...visible.map((section) => tvHomeRailGroupId(section.kind)),
    ];
    const chain = buildTvHomeNeighbourChain(groupIds);

    return {
        navNeighbours: chain.get(TV_HOME_NAV_GROUP_ID) ?? {},
        heroNeighbours: hasHero
            ? (chain.get(TV_HOME_HERO_GROUP_ID) ?? {})
            : null,
        rails: visible.map((section) => {
            const groupId = tvHomeRailGroupId(section.kind);
            return {
                ...section,
                groupId,
                titleKey: tvHomeRailTitleKey(section.kind),
                neighbours: chain.get(groupId) ?? {},
            };
        }),
    };
}
