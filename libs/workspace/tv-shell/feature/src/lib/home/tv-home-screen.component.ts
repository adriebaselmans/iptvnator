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
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs';
import {
    XtreamStore,
    type XtreamCredentials,
} from '@iptvnator/portal/xtream/data-access';
import {
    DataService,
    resetHostConnectivityGuard,
    SettingsStore,
} from '@iptvnator/services';
import { normalizeDashboardRailsSettings } from '@iptvnator/shared/interfaces';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    DashboardDataService,
    DashboardRecommendationsService,
    DashboardTrendingService,
} from '@iptvnator/workspace/dashboard/data-access';
import {
    TvCatalogStateComponent,
    TvHomeHeroComponent,
    TvHomeRailComponent,
    type TvHomeRailItem,
} from '@iptvnator/workspace/tv-shell/ui';
import { TvLiveEpgFeedService } from '../live/tv-live-epg-feed.service';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { buildTvHomeScreenState } from './tv-home-screen-state';
import {
    TV_HOME_HERO_GROUP_ID,
    TV_HOME_RAIL_ITEM_LIMIT,
    type TvHomeNavigableRailItem,
} from './tv-home-screen.util';

/**
 * `/tv/xtreams/:id/home` (§7.2): a hero (backdrop, title, resume CTA) above
 * horizontal rails, all sourced from the existing dashboard services —
 * `DashboardDataService`, `DashboardTrendingService`,
 * `DashboardRecommendationsService` — consumed unchanged (§8.1). Every rail
 * is filtered to this playlist and capped to a short slice; there is no
 * `loadMore` here, unlike the catalogue's poster grid.
 *
 * Bootstraps `XtreamStore` through the shared session (§8.1a) so a
 * subsequent home → movies → series hop reuses it instead of
 * re-initialising. The dashboard-service-driven rails do not themselves
 * depend on that bootstrap, but it is Home's only genuine failure signal —
 * see the phase report for why that is a real spec gap, not a corner cut.
 *
 * Every derived view/gating signal lives in `buildTvHomeScreenState()`
 * (`tv-home-screen-state.ts`) — this component is route params, the
 * bootstrap sequence, the load-triggering effects and the action handlers.
 */
@Component({
    selector: 'lib-tv-home-screen',
    imports: [
        TranslateModule,
        TvCatalogStateComponent,
        TvHomeHeroComponent,
        TvHomeRailComponent,
    ],
    templateUrl: './tv-home-screen.component.html',
    styleUrl: './tv-home-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-home-screen' },
    // Component-scoped, matching the live screen: the feed's cache resets
    // with this screen instance instead of leaking across playlists.
    providers: [TvLiveEpgFeedService],
})
export class TvHomeScreenComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly store = inject(XtreamStore);
    private readonly session = inject(TvPlaylistSessionService);
    private readonly translate = inject(TranslateService);
    private readonly focusService = inject(TvFocusService);
    private readonly dataService = inject(DataService);
    private readonly settingsStore = inject(SettingsStore);
    private readonly epgFeed = inject(TvLiveEpgFeedService);
    protected readonly data = inject(DashboardDataService);
    private readonly trending = inject(DashboardTrendingService);
    private readonly recommendations = inject(DashboardRecommendationsService);

    protected readonly heroGroupId = TV_HOME_HERO_GROUP_ID;

    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );

    readonly playlistId = toSignal(
        this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
        { initialValue: '' }
    );

    protected readonly isBootstrapping = signal(false);
    protected readonly bootstrapFailed = signal(false);

    protected readonly dashboardRailsSettings = computed(() =>
        normalizeDashboardRailsSettings(this.settingsStore.dashboardRails?.())
    );

    private readonly state = buildTvHomeScreenState({
        data: this.data,
        trending: this.trending,
        recommendations: this.recommendations,
        epgFeed: this.epgFeed,
        playlistId: this.playlistId,
        dashboardRailsSettings: this.dashboardRailsSettings,
        isBootstrapping: this.isBootstrapping,
        bootstrapFailed: this.bootstrapFailed,
    });
    protected readonly hero = this.state.hero;
    protected readonly layout = this.state.layout;
    protected readonly isLoading = this.state.isLoading;
    protected readonly hasError = this.state.hasError;
    protected readonly isEmpty = this.state.isEmpty;

    private lastBootstrappedPlaylistId: string | null = null;
    private hasSetInitialFocus = false;

    constructor() {
        effect(() => {
            const playlistId = this.playlistId();
            if (!playlistId) return;
            untracked(() => {
                void this.bootstrap(playlistId);
                void this.data.reloadGlobalRecentItems();
                void this.data.reloadGlobalFavorites();
            });
        });

        effect(() => {
            if (
                this.data.xtreamPlaylistCount() === 0 ||
                !this.data.globalFavoritesLoaded()
            ) {
                return;
            }
            untracked(() =>
                void this.data.reloadXtreamRecentlyAddedItems(
                    TV_HOME_RAIL_ITEM_LIMIT
                )
            );
        });

        effect(() => {
            if (
                !this.dashboardRailsSettings().tmdbTrending ||
                !this.data.globalFavoritesLoaded()
            ) {
                return;
            }
            untracked(() => void this.trending.load());
        });

        effect(() => {
            if (
                !this.dashboardRailsSettings().tmdbRecommendations ||
                !this.data.globalFavoritesLoaded()
            ) {
                return;
            }
            this.data.globalRecentVodItems();
            this.data.globalFavoriteItems();
            this.data.playlists();
            this.languageTick();
            untracked(() => void this.recommendations.load());
        });

        // Throttled through EpgQueueService — never one request per channel
        // (§14 correction: that is exactly what trips HostConnectivityGuard).
        effect(() => {
            const items = this.state.liveNowSourceItems();
            const playlistId = this.playlistId();
            untracked(() => {
                if (items.length === 0) return;
                const credentials = this.resolveCredentials();
                if (!credentials) return;
                this.epgFeed.ensureVisibleEntries(
                    items.map((item) => ({
                        streamId: Number(item.xtream_id),
                        epgChannelId: item.epg_lookup_key ?? null,
                        playlistId,
                    })),
                    credentials
                );
            });
        });

        effect(() => {
            if (this.hasSetInitialFocus) return;
            if (this.isLoading() || this.hasError()) return;
            const layout = this.layout();
            const hasHero = this.hero() !== null;
            if (!hasHero && layout.rails.length === 0) return;
            untracked(() => {
                this.hasSetInitialFocus = true;
                const groupId = hasHero
                    ? TV_HOME_HERO_GROUP_ID
                    : layout.rails[0].groupId;
                this.focusService.setActive(groupId, 0);
            });
        });
    }

    protected onResumeActivated(): void {
        const hero = this.hero();
        if (hero) {
            void this.router.navigate(hero.route as string[]);
        }
    }

    /**
     * `TvHomeRailComponent` declares its output as the ui-layer
     * `TvHomeRailItem` (id/title/posterUrl/subtitle/kind) because that
     * library must not know about routing. The runtime object it emits is
     * always the exact `TvHomeNavigableRailItem` this screen built —
     * `route` included — so this cast is a same-source-code guarantee, not
     * a real widening.
     */
    protected onRailItemActivated(item: TvHomeRailItem): void {
        const route = (item as TvHomeNavigableRailItem).route;
        if (route) {
            void this.router.navigate(route as string[]);
        }
    }

    protected onRetry(): void {
        const playlist = this.store.currentPlaylist();
        // Resets HostConnectivityGuard before its first request (§10) —
        // same sanctioned primitive the detail screen's Retry uses directly.
        void resetHostConnectivityGuard(
            this.dataService,
            playlist?.serverUrl
        ).then(() => this.bootstrap(this.playlistId(), true));
    }

    private resolveCredentials(): XtreamCredentials | null {
        const playlist = this.store.currentPlaylist();
        if (!playlist) return null;
        return {
            serverUrl: playlist.serverUrl,
            username: playlist.username,
            password: playlist.password,
            allowedOutputFormats: playlist.allowedOutputFormats,
        };
    }

    private async bootstrap(
        playlistId: string,
        force = false
    ): Promise<void> {
        if (!playlistId) return;
        if (!force && this.lastBootstrappedPlaylistId === playlistId) return;
        this.lastBootstrappedPlaylistId = playlistId;
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
    }
}
