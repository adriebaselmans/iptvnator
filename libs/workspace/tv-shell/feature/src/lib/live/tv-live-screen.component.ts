import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs';
import {
    findCurrentEpgItem,
    XtreamStore,
    type XtreamCredentials,
} from '@iptvnator/portal/xtream/data-access';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import type { PlayerMediaTitle } from '@iptvnator/ui/playback';
import {
    TvCatalogStateComponent,
    TvCategoryRailComponent,
    TvChannelBarComponent,
    TvEpgGridComponent,
    type TvChannelBarItem,
    type TvEpgGridRow,
} from '@iptvnator/workspace/tv-shell/ui';
import { buildTvCategoryRailItems } from '../catalog/tv-catalog-screen.util';
import { TvPlaybackOverlayComponent } from '../playback/tv-playback-overlay.component';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvLiveEpgFeedService } from './tv-live-epg-feed.service';
import {
    buildTvChannelBarItems,
    buildTvEpgGridRow,
    resolveTvZapTarget,
    toEpgProgrammeSummary,
    toTvLiveChannel,
    type TvLiveChannelSource,
} from './tv-live-screen.util';

const CHANNEL_BAR_GROUP_ID = 'tv-live-channel-bar';
const CATEGORY_COLUMN_GROUP_ID = 'tv-live-category-column';
const EPG_ROW_GROUP_PREFIX = 'tv-live-epg-row';
/** §7.3: overlays auto-hide after 5 s of no input. */
const IDLE_HIDE_MS = 5000;

/**
 * `/tv/xtreams/:id/live` (§7.3): the TiviMate interaction model. Video fills
 * the screen through `TvPlaybackOverlayComponent` (§9.1b's engine chain,
 * unchanged from Phase 4b); Up/Down zap channels directly; OK opens the
 * channel bar; from the bar, Left opens the category column and Right opens
 * the EPG grid, both reached through the ordinary focus graph rather than
 * bespoke key handling (§6.2 "index arithmetic, not DOM geometry") — the
 * category column and EPG grid rows are mounted the moment the bar opens so
 * their groups exist to exit into, and which pane is visually shown is
 * derived from `TvFocusService.activeGroupId()`, never tracked separately.
 */
@Component({
    selector: 'lib-tv-live-screen',
    imports: [
        TranslateModule,
        TvCatalogStateComponent,
        TvCategoryRailComponent,
        TvChannelBarComponent,
        TvEpgGridComponent,
        TvPlaybackOverlayComponent,
    ],
    templateUrl: './tv-live-screen.component.html',
    styleUrl: './tv-live-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-live-screen' },
    // Component-scoped, not root: the feed's cache/subscription reset with
    // this screen instance instead of leaking results across playlists.
    providers: [TvLiveEpgFeedService],
})
export class TvLiveScreenComponent {
    private readonly route = inject(ActivatedRoute);
    protected readonly store = inject(XtreamStore);
    private readonly session = inject(TvPlaylistSessionService);
    private readonly translate = inject(TranslateService);
    private readonly focusService = inject(TvFocusService);
    private readonly location = inject(Location);
    private readonly destroyRef = inject(DestroyRef);
    private readonly epgFeed = inject(TvLiveEpgFeedService);

    protected readonly channelBarGroupId = CHANNEL_BAR_GROUP_ID;
    protected readonly categoryColumnGroupId = CATEGORY_COLUMN_GROUP_ID;
    protected readonly epgRowGroupPrefix = EPG_ROW_GROUP_PREFIX;
    protected readonly categoryColumnNeighbours = {
        right: CHANNEL_BAR_GROUP_ID,
    } as const;

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
    protected readonly overlayOpen = signal(false);
    protected readonly playingChannelId = signal<number | null>(null);
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private lastBootstrappedPlaylistId: string | null = null;

    protected readonly channels = computed<TvLiveChannelSource[]>(() =>
        this.store
            .selectItemsFromSelectedCategory()
            .map(toTvLiveChannel)
            .filter((channel): channel is TvLiveChannelSource => channel !== null)
    );
    protected readonly channelBarItems = computed<TvChannelBarItem[]>(() =>
        buildTvChannelBarItems(this.channels())
    );
    protected readonly categories = computed(() => {
        this.languageTick();
        return buildTvCategoryRailItems(
            this.store.getCategoriesBySelectedType(),
            this.store.getCategoryItemCounts(),
            this.translate.instant('TV.CATALOG.ALL_CATEGORIES')
        );
    });
    protected readonly selectedCategoryId = computed(() =>
        this.store.selectedCategoryId()
    );

    protected readonly streamUrl = computed(() => this.store.streamUrl() ?? '');
    protected readonly mediaTitle = computed<PlayerMediaTitle | null>(() => {
        const id = this.playingChannelId();
        const channel = this.channels().find(
            (candidate) => resolveChannelId(candidate) === id
        );
        return channel ? { primary: channel.name } : null;
    });

    protected readonly isLoading = computed(
        () => this.isBootstrapping() || this.store.isPaginatedContentLoading()
    );
    protected readonly errorReason = computed(
        () => this.bootstrapFailed() || this.store.contentInitBlockReason() !== null
    );
    protected readonly isEmpty = computed(
        () =>
            !this.isLoading() &&
            !this.errorReason() &&
            this.channelBarItems().length === 0
    );

    protected readonly highlightedChannel = computed<TvChannelBarItem | null>(
        () => {
            if (this.focusService.activeGroupId() !== CHANNEL_BAR_GROUP_ID) {
                return null;
            }
            return this.channelBarItems()[this.focusService.activeIndex()] ?? null;
        }
    );
    protected readonly highlightedProgramme = computed(() => {
        const channel = this.highlightedChannel();
        if (!channel) return null;
        const items = this.epgFeed.epgByStreamId().get(channel.id) ?? [];
        return toEpgProgrammeSummary(findCurrentEpgItem(items, Date.now()));
    });

    protected readonly epgGridRows = computed<TvEpgGridRow[]>(() => {
        const cache = this.epgFeed.epgByStreamId();
        const now = Date.now();
        return this.channels().map((channel) => {
            const id = resolveChannelId(channel);
            return buildTvEpgGridRow(id, channel.name, cache.get(id) ?? [], now);
        });
    });
    protected readonly channelBarNeighbours = computed(() => {
        const firstRow = this.epgGridRows()[0];
        return {
            left: CATEGORY_COLUMN_GROUP_ID,
            right: firstRow ? `${EPG_ROW_GROUP_PREFIX}-${firstRow.channelId}` : undefined,
        };
    });
    protected readonly showCategoryColumn = computed(
        () =>
            this.overlayOpen() &&
            this.focusService.activeGroupId() === CATEGORY_COLUMN_GROUP_ID
    );
    protected readonly showEpgGrid = computed(() => {
        if (!this.overlayOpen()) return false;
        const groupId = this.focusService.activeGroupId();
        return groupId != null && groupId.startsWith(`${EPG_ROW_GROUP_PREFIX}-`);
    });

    constructor() {
        effect(() => {
            const playlistId = this.playlistId();
            if (!playlistId) return;
            untracked(() => {
                if (this.lastBootstrappedPlaylistId === playlistId) return;
                this.lastBootstrappedPlaylistId = playlistId;
                void this.bootstrap(playlistId);
            });
        });

        // Auto-tunes the first channel and opens the channel bar overlay
        // once the category's channels are available and nothing has been
        // tuned yet (fresh screen mount). The overlay starts open so the
        // user sees the channel list and EPG immediately instead of a
        // black screen.
        effect(() => {
            const channels = this.channels();
            untracked(() => {
                if (this.playingChannelId() !== null || channels.length === 0) {
                    return;
                }
                this.tuneChannel(channels[0]);
                this.onOpenChannelBar();
            });
        });

        // Requests EPG for the current category through the shared,
        // throttled `EpgQueueService` (see `TvLiveEpgFeedService`) once the
        // overlay opens — never eagerly, and never as one unthrottled
        // request per channel. Feeds both the channel bar's highlighted
        // programme and the EPG grid's rows via the feed's shared cache.
        // Re-runs if the category (and therefore channel list) changes
        // while the overlay stays open.
        effect(() => {
            const open = this.overlayOpen();
            const channels = this.channels();
            const playlistId = this.playlistId();
            untracked(() => {
                if (!open) return;
                const credentials = this.resolveCredentials();
                if (credentials) {
                    this.epgFeed.ensureVisible(channels, playlistId, credentials);
                }
            });
        });

        // Auto-hide (§7.3): any focus movement while the overlay is open
        // counts as input and resets the 5 s idle timer.
        effect(() => {
            this.focusService.activeGroupId();
            this.focusService.activeIndex();
            untracked(() => {
                if (this.overlayOpen()) this.scheduleIdleHide();
            });
        });

        this.destroyRef.onDestroy(() => {
            if (this.idleTimer) clearTimeout(this.idleTimer);
        });
    }

    protected onChannelChange(direction: 'up' | 'down'): void {
        const target = resolveTvZapTarget(
            this.channels(),
            this.playingChannelId(),
            direction
        );
        if (target) this.tuneChannel(target);
    }

    protected onOpenChannelBar(): void {
        this.overlayOpen.set(true);
        const items = this.channelBarItems();
        const index = items.findIndex((item) => item.id === this.playingChannelId());
        // The channel bar's focus group is always mounted (§7.3 template
        // comment), so it is registered from the first render — no need to
        // defer this past a change-detection cycle.
        this.focusService.setActive(CHANNEL_BAR_GROUP_ID, index === -1 ? 0 : index);
        this.scheduleIdleHide();
    }

    protected onOverlayBack(): void {
        this.closeOverlay();
    }

    protected onExited(): void {
        this.location.back();
    }

    protected onChannelBarActivated(item: TvChannelBarItem): void {
        this.tuneAndClose(item.id);
    }

    protected onEpgRowActivated(row: TvEpgGridRow): void {
        this.tuneAndClose(row.channelId);
    }

    protected onCategorySelected(categoryId: number | null): void {
        this.store.setSelectedCategory(categoryId);
        this.focusService.setActive(CHANNEL_BAR_GROUP_ID, 0);
    }

    protected onRetry(): void {
        // §10: resets HostConnectivityGuard before its first request —
        // handled inside retryContentInitialization() itself (same
        // reuse as the movies/series catalogue screen).
        void this.store.retryContentInitialization();
    }

    private tuneAndClose(channelId: number): void {
        const channel = this.channels().find(
            (candidate) => resolveChannelId(candidate) === channelId
        );
        if (channel) this.tuneChannel(channel);
        this.closeOverlay();
    }

    private closeOverlay(): void {
        this.overlayOpen.set(false);
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    private tuneChannel(channel: TvLiveChannelSource): void {
        const id = resolveChannelId(channel);
        this.playingChannelId.set(id);
        this.store.constructStreamUrl({ ...channel, xtream_id: id });
    }

    /**
     * Xtream API credentials for the current playlist, in the shape
     * `EpgQueueService.enqueue()` needs. `null` while the playlist hasn't
     * resolved yet (e.g. mid-bootstrap) — the caller skips enqueueing
     * rather than sending a request with empty credentials.
     */
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

    private scheduleIdleHide(): void {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.overlayOpen.set(false);
        }, IDLE_HIDE_MS);
    }

    private async bootstrap(playlistId: string): Promise<void> {
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
        this.store.setSelectedContentType('live');
    }
}

function resolveChannelId(stream: TvLiveChannelSource): number {
    return Number(stream.xtream_id ?? stream.stream_id);
}
