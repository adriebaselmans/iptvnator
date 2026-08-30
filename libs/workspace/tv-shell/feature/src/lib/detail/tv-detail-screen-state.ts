import { computed, type Signal } from '@angular/core';
import {
    resolveXtreamVodPlaybackSource,
    type XtreamStoreType,
} from '@iptvnator/portal/xtream/data-access';
import type { XtreamSerieEpisode } from '@iptvnator/shared/interfaces';
import { getXtreamVodInfo } from '@iptvnator/shared/interfaces';
import type { TvEpisodeRowItem } from '@iptvnator/workspace/tv-shell/ui';
import {
    resolveTvDetailActionGating,
    resolveTvMovieItem,
    resolveTvSeriesItem,
    toTvEpisodeRowItem,
    type TvDetailPlaybackTarget,
} from './tv-detail-actions.util';
import {
    buildTvMovieViewModel,
    buildTvSeriesViewModel,
    resolveTvAutoSeason,
    resolveTvQuickStartEpisode,
    type TvDetailRouteType,
} from './tv-detail-screen.util';

export interface TvDetailStateDeps {
    readonly store: XtreamStoreType;
    readonly routeType: Signal<TvDetailRouteType | null>;
    readonly itemId: Signal<string>;
    readonly manualSeasonKey: Signal<string | null>;
    readonly isLoading: Signal<boolean>;
    readonly hasError: Signal<boolean>;
    readonly downloadsAvailable: Signal<boolean>;
}

/**
 * Every computed view/gating signal the detail screen's template reads (§7.5).
 * Factored out of the component itself so the component stays orchestration
 * (route params, bootstrap, action handlers) — this is the pure mapping layer
 * beside `tv-detail-screen.util.ts`/`tv-detail-actions.util.ts`, just built
 * from signals instead of plain values because the auto season/quick-start
 * resolution has to react to store state.
 */
export function buildTvDetailState(deps: TvDetailStateDeps) {
    const { store, routeType, itemId } = deps;
    const itemIdNumeric = computed(() => Number(itemId()));

    const movieItem = computed(() =>
        routeType() === 'movie'
            ? resolveTvMovieItem(store.selectedItem() as never, itemIdNumeric())
            : null
    );
    const seriesItem = computed(() =>
        routeType() === 'series'
            ? resolveTvSeriesItem(store.selectedItem() as never, itemIdNumeric())
            : null
    );
    const isEmpty = computed(
        () =>
            !deps.isLoading() &&
            !deps.hasError() &&
            routeType() !== null &&
            movieItem() === null &&
            seriesItem() === null
    );
    const viewModel = computed(() =>
        routeType() === 'movie'
            ? buildTvMovieViewModel(getXtreamVodInfo(movieItem()), '')
            : buildTvSeriesViewModel(seriesItem()?.info ?? null, '')
    );

    const seasons = computed(() => seriesItem()?.episodes ?? {});
    const seasonTabs = computed(() =>
        Object.keys(seasons())
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => ({ key }))
    );
    const autoSeasonKey = computed(() =>
        resolveTvAutoSeason({
            seasons: seasons(),
            playingEpisodeId: null,
            isEpisodeInProgress: (id) => store.isInProgress(id, 'episode'),
            isEpisodeWatched: (id) => store.isWatched(id, 'episode'),
            episodeUpdatedAt: (id) =>
                store.playbackPositions().get(`episode_${id}`)?.updatedAt,
        })
    );
    const selectedSeasonKey = computed(() => {
        const manual = deps.manualSeasonKey();
        const keys = seasonTabs().map((tab) => tab.key);
        return manual && keys.includes(manual) ? manual : autoSeasonKey();
    });
    const selectedSeasonEpisodes = computed<readonly XtreamSerieEpisode[]>(
        () => seasons()[selectedSeasonKey() ?? ''] ?? []
    );
    const episodeItems = computed<TvEpisodeRowItem[]>(() =>
        selectedSeasonEpisodes().map((episode) =>
            toTvEpisodeRowItem(episode, store.isWatched(Number(episode.id), 'episode'))
        )
    );
    const quickStartEpisode = computed(() =>
        resolveTvQuickStartEpisode(selectedSeasonEpisodes(), (id) =>
            store.isWatched(id, 'episode')
        )
    );

    const playbackTarget = computed<TvDetailPlaybackTarget | null>(() => {
        if (routeType() === 'movie') {
            const item = movieItem();
            if (!item) return null;
            return {
                xtreamId: itemIdNumeric(),
                contentType: 'vod',
                hasPlayableSource: resolveXtreamVodPlaybackSource(item) !== null,
                durationSeconds: getXtreamVodInfo(item)?.duration_secs,
            };
        }
        const episode = quickStartEpisode();
        if (!episode) return null;
        const info = Array.isArray(episode.info) ? null : episode.info;
        return {
            xtreamId: Number(episode.id),
            contentType: 'episode',
            hasPlayableSource: true,
            durationSeconds: info?.duration_secs,
        };
    });
    const actionGating = computed(() =>
        resolveTvDetailActionGating(
            playbackTarget(),
            deps.downloadsAvailable(),
            (id, type) => store.isInProgress(id, type),
            (id, type) => store.isWatched(id, type)
        )
    );

    return {
        itemIdNumeric,
        movieItem,
        seriesItem,
        isEmpty,
        viewModel,
        seasonTabs,
        selectedSeasonKey,
        selectedSeasonEpisodes,
        episodeItems,
        quickStartEpisode,
        playbackTarget,
        actionGating,
    };
}

export type TvDetailState = ReturnType<typeof buildTvDetailState>;
