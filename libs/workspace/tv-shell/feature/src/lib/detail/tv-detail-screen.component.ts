import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    signal,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';
import {
    resolveXtreamVodPlaybackSource,
    XtreamStore,
} from '@iptvnator/portal/xtream/data-access';
import {
    DataService,
    DownloadsService,
    resetHostConnectivityGuard,
} from '@iptvnator/services';
import { getXtreamVodInfo } from '@iptvnator/shared/interfaces';
import type { PlayerMediaTitle } from '@iptvnator/ui/playback';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvCatalogStateComponent,
    TvDetailActionRowComponent,
    TvDetailHeroComponent,
    TvEpisodeRowComponent,
    TvSeasonTabsComponent,
    type TvEpisodeRowItem,
} from '@iptvnator/workspace/tv-shell/ui';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvPlaybackOverlayComponent } from '../playback/tv-playback-overlay.component';
import {
    buildTvEpisodeDownloadPayload,
    buildTvPlaybackPositionPayload,
    buildTvVodDownloadPayload,
    resolveTvResumeSeconds,
    type TvNowPlaying,
} from './tv-detail-actions.util';
import { buildTvDetailState } from './tv-detail-screen-state';
import {
    buildMarkWatchedPosition,
    parseTvDetailRouteType,
    type TvDetailRouteType,
} from './tv-detail-screen.util';

const HERO_ACTIONS_GROUP_ID = 'tv-detail-actions';
const SEASON_TABS_GROUP_ID = 'tv-detail-seasons';
const EPISODE_ROW_GROUP_ID = 'tv-detail-episodes';
const RETRY_GROUP_ID = 'tv-detail-state-retry';

/**
 * `/tv/xtreams/:id/detail/:type/:itemId` (§7.5): full-bleed hero plus the
 * focusable action row every secondary action lives on (§6.4). Series add
 * season tabs and an episode row, reusing the desktop's season-selection
 * semantics (`resolveTvAutoSeason`, ported from `SeasonContainerComponent`
 * into `tv-detail-screen.util.ts`).
 *
 * Every derived view/gating signal lives in `buildTvDetailState()`
 * (`tv-detail-screen-state.ts`) — this component is route params, the
 * bootstrap sequence, and the action handlers.
 *
 * Playback is Phase 4's: Play/Resume and the episode row only resolve the
 * stream URL through the store (`constructVodStreamUrl`/
 * `constructEpisodeStreamUrl`, exactly how the desktop detail resolves it)
 * and record it as playback intent — see the `// Phase 4 seam` comments.
 */
@Component({
    selector: 'lib-tv-detail-screen',
    imports: [
        TranslateModule,
        TvCatalogStateComponent,
        TvDetailHeroComponent,
        TvDetailActionRowComponent,
        TvSeasonTabsComponent,
        TvEpisodeRowComponent,
        TvPlaybackOverlayComponent,
    ],
    templateUrl: './tv-detail-screen.component.html',
    styleUrl: './tv-detail-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-detail-screen' },
})
export class TvDetailScreenComponent {
    private readonly route = inject(ActivatedRoute);
    protected readonly store = inject(XtreamStore);
    private readonly session = inject(TvPlaylistSessionService);
    private readonly downloadsService = inject(DownloadsService);
    private readonly dataService = inject(DataService);
    private readonly focusService = inject(TvFocusService);

    protected readonly heroActionsGroupId = HERO_ACTIONS_GROUP_ID;
    protected readonly seasonTabsGroupId = SEASON_TABS_GROUP_ID;
    protected readonly episodeRowGroupId = EPISODE_ROW_GROUP_ID;
    protected readonly retryGroupId = RETRY_GROUP_ID;
    protected readonly actionsNeighbours = { down: SEASON_TABS_GROUP_ID } as const;
    protected readonly seasonsNeighbours = {
        up: HERO_ACTIONS_GROUP_ID,
        down: EPISODE_ROW_GROUP_ID,
    } as const;
    protected readonly episodesNeighbours = { up: SEASON_TABS_GROUP_ID } as const;

    readonly playlistId = toSignal(
        this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
        { initialValue: '' }
    );
    protected readonly routeType = toSignal(
        this.route.paramMap.pipe(
            map((params) => parseTvDetailRouteType(params.get('type')))
        ),
        { initialValue: null as TvDetailRouteType | null }
    );
    protected readonly itemId = toSignal(
        this.route.paramMap.pipe(map((params) => params.get('itemId') ?? '')),
        { initialValue: '' }
    );

    private readonly isBootstrapping = signal(false);
    private readonly bootstrapFailed = signal(false);
    private readonly manualSeasonKey = signal<string | null>(null);
    private readonly nowPlaying = signal<TvNowPlaying | null>(null);
    private lastInitKey: string | null = null;
    private hasSetInitialFocus = false;
    private wasError = false;

    protected readonly isPlaying = computed(() => this.nowPlaying() !== null);
    protected readonly playbackResumeSeconds = computed(() =>
        resolveTvResumeSeconds(this.store.playbackPositions(), this.nowPlaying())
    );
    protected readonly playbackMediaTitle = computed<PlayerMediaTitle | null>(
        () => {
            const title = this.viewModel().title;
            return title ? { primary: title } : null;
        }
    );

    protected readonly isFavorite = this.store.isFavorite;
    protected readonly isLoading = computed(
        () => this.isBootstrapping() || this.store.isLoadingDetails()
    );
    protected readonly hasError = computed(
        () => this.bootstrapFailed() || this.store.detailsError() !== null
    );

    private readonly state = buildTvDetailState({
        store: this.store,
        routeType: this.routeType,
        itemId: this.itemId,
        manualSeasonKey: this.manualSeasonKey,
        isLoading: this.isLoading,
        hasError: this.hasError,
        downloadsAvailable: this.downloadsService.isAvailable,
    });
    protected readonly movieItem = this.state.movieItem;
    protected readonly seriesItem = this.state.seriesItem;
    protected readonly isEmpty = this.state.isEmpty;
    protected readonly viewModel = this.state.viewModel;
    protected readonly seasonTabs = this.state.seasonTabs;
    protected readonly selectedSeasonKey = this.state.selectedSeasonKey;
    protected readonly episodeItems = this.state.episodeItems;
    protected readonly actionGating = this.state.actionGating;

    constructor() {
        effect(() => {
            const playlistId = this.playlistId();
            const type = this.routeType();
            const itemId = this.itemId();
            void this.bootstrap(playlistId, type, itemId);
        });

        // Correction (Phase 8 audit): this screen never called
        // `TvFocusService.setActive()` at all. It is the screen every poster
        // card leads to, and it carries the action row (Play/Resume,
        // Favourite, Download, Mark watched) — with nothing focused on
        // arrival none of those are reachable, so a remote-only user could
        // browse to a title and then be unable to play it.
        // `unregisterGroup()` nulls the active group when the previous
        // screen's groups tear down, so arriving unfocused is the default,
        // not an edge case. Focus lands on the action row's first item
        // (Play/Resume when the item is playable, per §6.4 the row only ever
        // renders actions the item actually supports, so index 0 is always
        // the primary one available).
        //
        // Angular flushes effects BEFORE change detection runs
        // (`ComponentFixture.detectChanges()`/`ApplicationRef.tick()`), so
        // the action row's `ngOnInit` — which registers its focus group —
        // has not run yet the first time this guard is satisfied, even
        // though the gating signals (`isLoading`/`hasError`/`isEmpty`) can
        // already read as ready. `queueMicrotask` defers the actual
        // `setActive()` call past that change-detection pass.
        effect(() => {
            if (this.hasSetInitialFocus) return;
            if (this.isLoading() || this.hasError() || this.isEmpty()) return;
            this.hasSetInitialFocus = true;
            untracked(() => {
                queueMicrotask(() =>
                    this.focusService.setActive(HERO_ACTIONS_GROUP_ID, 0)
                );
            });
        });

        // The Phase 8 fix above deliberately excludes the error state — it
        // only ever activates the success-path hero actions. That left the
        // error state's OWN Retry with the exact same defect the Phase 8
        // audit found and fixed everywhere else: `lib-tv-catalog-state`
        // registers `retryGroupId`'s focus group, but nothing ever called
        // `setActive()` for it, so Retry rendered fully visible with no way
        // to reach it from the remote — confirmed against a real Xtream
        // provider whose `get_vod_info` returned a non-2xx status (§10).
        // Tracks the previous `hasError()` reading rather than a one-shot
        // latch: a failed Retry re-enters this same error state, and Retry
        // must be reachable again each time, not only the first.
        effect(() => {
            const failed = this.hasError();
            if (failed && !this.wasError) {
                queueMicrotask(() =>
                    this.focusService.setActive(this.retryGroupId, 0)
                );
            }
            this.wasError = failed;
        });
    }

    protected onSeasonSelected(key: string): void {
        this.manualSeasonKey.set(key);
        this.store.enrichSelectedSerialSeason(key);
    }

    protected onEpisodeActivated(item: TvEpisodeRowItem): void {
        const episode = this.state
            .selectedSeasonEpisodes()
            .find((candidate) => Number(candidate.id) === item.id);
        if (!episode) return;
        this.store.constructEpisodeStreamUrl(episode);
        this.nowPlaying.set({
            xtreamId: Number(episode.id),
            contentType: 'episode',
            seriesXtreamId: this.state.itemIdNumeric(),
        });
    }

    protected onPlayActivated(): void {
        if (this.routeType() === 'movie') {
            const item = this.movieItem();
            if (!item) return;
            this.store.constructVodStreamUrl(item);
            this.nowPlaying.set({
                xtreamId: this.state.itemIdNumeric(),
                contentType: 'vod',
            });
            return;
        }
        const episode = this.state.quickStartEpisode();
        if (!episode) return;
        this.store.constructEpisodeStreamUrl(episode);
        this.nowPlaying.set({
            xtreamId: Number(episode.id),
            contentType: 'episode',
            seriesXtreamId: this.state.itemIdNumeric(),
        });
    }

    /** `TvPlaybackOverlayComponent` reports progress on an interval (§9). */
    protected onPlaybackProgress(progress: {
        positionSeconds: number;
        durationSeconds: number | null;
    }): void {
        const playing = this.nowPlaying();
        const playlist = this.store.currentPlaylist();
        if (!playing || !playlist) return;
        void this.store.savePosition(
            playlist.id,
            buildTvPlaybackPositionPayload({
                playlistId: playlist.id,
                nowPlaying: playing,
                positionSeconds: progress.positionSeconds,
                durationSeconds: progress.durationSeconds,
            })
        );
    }

    /** Back exits playback (§9.2) — closes the overlay, does not navigate. */
    protected onPlaybackExited(): void {
        this.nowPlaying.set(null);
        this.store.resetPlayer();
    }

    protected onFavoriteToggled(): void {
        const playlist = this.store.currentPlaylist();
        const type = this.routeType();
        if (!playlist || !type) return;
        const backdrop =
            type === 'movie'
                ? getXtreamVodInfo(this.movieItem())?.backdrop_path?.[0]
                : this.seriesItem()?.info?.backdrop_path?.[0];
        this.store.toggleFavorite(this.itemId(), playlist.id, type, backdrop);
    }

    protected onMarkWatchedToggled(): void {
        const playlist = this.store.currentPlaylist();
        const target = this.state.playbackTarget();
        if (!playlist || !target?.durationSeconds) return;
        void this.store.savePosition(
            playlist.id,
            buildMarkWatchedPosition({
                playlistId: playlist.id,
                contentXtreamId: target.xtreamId,
                contentType: target.contentType,
                durationSeconds: this.actionGating().isWatched ? 0 : target.durationSeconds,
                ...(target.contentType === 'episode'
                    ? { seriesXtreamId: this.state.itemIdNumeric() }
                    : {}),
            })
        );
    }

    protected onDownloadActivated(): void {
        const playlist = this.store.currentPlaylist();
        if (!playlist) return;
        const context = {
            playlistId: playlist.id,
            playlistName: playlist.name ?? playlist.title,
            serverUrl: playlist.serverUrl,
            userAgent: playlist.userAgent,
            referrer: playlist.referrer,
            origin: playlist.origin,
        };

        if (this.routeType() === 'movie') {
            const item = this.movieItem();
            if (!item || !resolveXtreamVodPlaybackSource(item)) return;
            void this.downloadsService.startDownload(
                buildTvVodDownloadPayload({
                    playlist: context,
                    xtreamId: this.state.itemIdNumeric(),
                    title: this.viewModel().title,
                    url: this.store.constructVodStreamUrl(item),
                    posterUrl: this.viewModel().posterUrl,
                })
            );
            return;
        }

        const episode = this.state.quickStartEpisode();
        if (!episode) return;
        void this.downloadsService.startDownload(
            buildTvEpisodeDownloadPayload({
                playlist: context,
                episode,
                seriesXtreamId: this.state.itemIdNumeric(),
                url: this.store.constructEpisodeStreamUrl(episode),
                posterUrl: this.viewModel().posterUrl,
            })
        );
    }

    protected onRetry(): void {
        const playlist = this.store.currentPlaylist();
        // Resets HostConnectivityGuard before its first request (§10) — the
        // sanctioned reset primitive (`resetHostConnectivityGuard`, the same
        // one `XtreamStore.retryContentInitialization()` calls internally),
        // called directly here because the desktop detail views have no
        // Retry affordance of their own to delegate to (see the phase
        // report).
        void resetHostConnectivityGuard(this.dataService, playlist?.serverUrl).then(() =>
            this.bootstrap(this.playlistId(), this.routeType(), this.itemId(), true)
        );
    }

    private async bootstrap(
        playlistId: string,
        type: TvDetailRouteType | null,
        itemId: string,
        force = false
    ): Promise<void> {
        if (!playlistId || !type || !itemId) return;

        const key = `${playlistId}:${type}:${itemId}`;
        if (!force && this.lastInitKey === key) return;
        this.lastInitKey = key;
        this.manualSeasonKey.set(null);
        // A different item (e.g. a Similar-rail hop that reuses this same
        // routed component) needs its own initial focus, not the leftover
        // flag from whatever was focused before.
        this.hasSetInitialFocus = false;

        this.isBootstrapping.set(true);
        this.bootstrapFailed.set(false);
        try {
            await this.session.ensureBootstrapped(playlistId);
        } catch {
            this.bootstrapFailed.set(true);
            this.isBootstrapping.set(false);
            return;
        }
        this.isBootstrapping.set(false);

        const categoryId = this.store.selectedCategoryId() ?? 0;
        const xtreamId = Number(itemId);
        if (type === 'movie') {
            this.store.fetchVodDetailsWithMetadata({ vodId: itemId, categoryId });
            this.store.checkFavoriteStatus(xtreamId, playlistId, 'movie');
            void this.store.loadVodPosition(playlistId, xtreamId);
        } else {
            this.store.fetchSerialDetailsWithMetadata({ serialId: itemId, categoryId });
            this.store.checkFavoriteStatus(xtreamId, playlistId, 'series');
            void this.store.loadSeriesPositions(playlistId, xtreamId);
        }
    }
}
