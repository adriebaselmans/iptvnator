import { computed, type Signal } from '@angular/core';
import { findCurrentEpgItem } from '@iptvnator/portal/xtream/data-access';
import type { DashboardRailsSettings } from '@iptvnator/shared/interfaces';
import type {
    DashboardDataService,
    DashboardRecommendationsService,
    DashboardTrendingService,
} from '@iptvnator/workspace/dashboard/data-access';
import type { TvLiveEpgFeedService } from '../live/tv-live-epg-feed.service';
import {
    buildTvHomeLayout,
    toTvHomeHero,
    toTvHomeMatchedRailItem,
    toTvHomeRailItem,
    TV_HOME_RAIL_ITEM_LIMIT,
    type TvHomeNavigableRailItem,
    type TvHomeRailSection,
    type TvHomeSourceItem,
} from './tv-home-screen.util';

export interface TvHomeStateDeps {
    readonly data: DashboardDataService;
    readonly trending: DashboardTrendingService;
    readonly recommendations: DashboardRecommendationsService;
    readonly epgFeed: TvLiveEpgFeedService;
    readonly playlistId: Signal<string>;
    readonly dashboardRailsSettings: Signal<DashboardRailsSettings>;
    readonly isBootstrapping: Signal<boolean>;
    readonly bootstrapFailed: Signal<boolean>;
}

function mapSection(
    items: readonly TvHomeSourceItem[],
    playlistId: string,
    idPrefix: string
): TvHomeNavigableRailItem[] {
    const mapped: TvHomeNavigableRailItem[] = [];
    for (const item of items) {
        const entry = toTvHomeRailItem(item, playlistId, idPrefix);
        if (entry) mapped.push(entry);
        if (mapped.length === TV_HOME_RAIL_ITEM_LIMIT) break;
    }
    return mapped;
}

function mapMatchedSection(
    entries: readonly {
        title: string;
        posterUrl: string | null;
        match: { playlistId: string; type: 'movie' | 'series'; xtreamId: number };
    }[],
    playlistId: string,
    idPrefix: string
): TvHomeNavigableRailItem[] {
    const mapped: TvHomeNavigableRailItem[] = [];
    for (const entry of entries) {
        const item = toTvHomeMatchedRailItem(entry, playlistId, idPrefix);
        if (item) mapped.push(item);
        if (mapped.length === TV_HOME_RAIL_ITEM_LIMIT) break;
    }
    return mapped;
}

/**
 * Every computed view signal the home screen's template reads (§7.2) —
 * hero, the six rails filtered/capped/mapped to router links, and the
 * loading/error/empty gates. Factored out of the component itself the same
 * way `tv-detail-screen-state.ts` factors the detail screen's state, so the
 * component stays route params, the bootstrap sequence and the effects that
 * feed these signals.
 */
export function buildTvHomeScreenState(deps: TvHomeStateDeps) {
    const { data, trending, recommendations, epgFeed, playlistId } = deps;

    const hero = computed(() => {
        const id = playlistId();
        const item = data
            .globalRecentVodItems()
            .find((candidate) => candidate.playlist_id === id);
        return toTvHomeHero(item, id);
    });

    const continueWatchingItems = computed(() =>
        mapSection(data.globalRecentVodItems(), playlistId(), 'cw')
    );
    const recentlyAddedItems = computed(() =>
        mapSection(data.xtreamRecentlyAddedItems(), playlistId(), 'added')
    );
    const favouriteItems = computed(() =>
        mapSection(
            data.globalFavoriteItems().filter((item) => item.type !== 'live'),
            playlistId(),
            'fav'
        )
    );

    const liveNowSourceItems = computed(() => {
        const id = playlistId();
        return data
            .globalFavoriteLiveItems()
            .filter((item) => item.playlist_id === id)
            .slice(0, TV_HOME_RAIL_ITEM_LIMIT);
    });

    // Current-programme titles for the visible "Live now" channels, fed by
    // `TvLiveEpgFeedService` (§14 correction — throttled, never per-item).
    const liveNowProgrammeTitles = computed<ReadonlyMap<number, string>>(() => {
        const cache = epgFeed.epgByStreamId();
        const now = Date.now();
        const titles = new Map<number, string>();
        for (const item of liveNowSourceItems()) {
            const id = Number(item.xtream_id);
            const epgItems = cache.get(id);
            const current = epgItems ? findCurrentEpgItem(epgItems, now) : null;
            if (current?.title) {
                titles.set(id, current.title);
            }
        }
        return titles;
    });

    const liveNowItems = computed<TvHomeNavigableRailItem[]>(() => {
        const id = playlistId();
        const titles = liveNowProgrammeTitles();
        const items: TvHomeNavigableRailItem[] = [];
        for (const item of liveNowSourceItems()) {
            const mapped = toTvHomeRailItem(item, id, 'live');
            if (!mapped) continue;
            const subtitle = titles.get(Number(item.xtream_id));
            items.push(subtitle ? { ...mapped, subtitle } : mapped);
        }
        return items;
    });

    const trendingItems = computed(() => {
        if (
            !deps.dashboardRailsSettings().tmdbTrending ||
            !trending.isAvailable
        ) {
            return [];
        }
        return mapMatchedSection(trending.items(), playlistId(), 'trend');
    });

    const recommendationItems = computed(() => {
        if (
            !deps.dashboardRailsSettings().tmdbRecommendations ||
            !recommendations.isAvailable
        ) {
            return [];
        }
        return mapMatchedSection(recommendations.items(), playlistId(), 'rec');
    });

    const sections = computed<TvHomeRailSection[]>(() => [
        { kind: 'continue-watching', items: continueWatchingItems() },
        { kind: 'recently-added', items: recentlyAddedItems() },
        { kind: 'favourites', items: favouriteItems() },
        { kind: 'live-now', items: liveNowItems() },
        { kind: 'trending', items: trendingItems() },
        { kind: 'recommendations', items: recommendationItems() },
    ]);

    const layout = computed(() => buildTvHomeLayout(hero() !== null, sections()));

    const isLoading = computed(
        () => deps.isBootstrapping() || !data.dashboardReady()
    );
    const hasError = computed(() => deps.bootstrapFailed());
    const isEmpty = computed(
        () =>
            !isLoading() &&
            !hasError() &&
            hero() === null &&
            layout().rails.length === 0
    );

    return {
        hero,
        liveNowSourceItems,
        layout,
        isLoading,
        hasError,
        isEmpty,
    };
}

export type TvHomeScreenState = ReturnType<typeof buildTvHomeScreenState>;
