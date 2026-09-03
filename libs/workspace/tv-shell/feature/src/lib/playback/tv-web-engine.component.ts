import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import type { PlaybackDiagnostic } from '@iptvnator/playback/util';
import {
    HtmlVideoPlayerComponent,
    type PlayerMediaTitle,
    WEB_PLAYER_SHARED_CONTROLS,
} from '@iptvnator/ui/playback';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvCatalogStateComponent } from '@iptvnator/workspace/tv-shell/ui';
import { tvPlaybackDiagnosticDescriptionKey } from './tv-playback-diagnostic-message.util';
import { TvPlayerControlsComponent } from './tv-player-controls.component';
import { buildTvWebEngineChannel } from './tv-web-engine-channel.util';

/** How often a still-playing session reports progress for position persistence. */
const PROGRESS_REPORT_INTERVAL_SECONDS = 5;
/**
 * Own focus group id for the playback error's Retry, distinct from
 * `TvCatalogStateComponent`'s default `tv-catalog-state-retry` — a screen
 * such as the detail page can have its own load-error retry (a different
 * group id) mounted at the same time playback is active.
 */
const PLAYBACK_ERROR_RETRY_GROUP_ID = 'tv-web-engine-playback-retry';

/**
 * The web-engine branch of the §9.1b engine chain: `HtmlVideoPlayerComponent`
 * already owns hls.js, Shaka and mpegts.js, so it covers HLS, DASH and raw
 * MPEG-TS. It is mounted with `WEB_PLAYER_SHARED_CONTROLS` forced on (the
 * published DI switch `WebPlayerViewComponent` uses for the same purpose) so
 * its internal `WebVideoControlsAdapter` attaches — that adapter, not the
 * player's own embedded `app-player-controls`, is what feeds
 * `lib-tv-player-controls`. `interactionEnabled=false` hides and disarms
 * that embedded controls bar and its shortcuts (the same trap Phase 4 found
 * in `app-player-controls` — see the phase report), leaving `TvPlayerControlsComponent`
 * as the sole controls surface and the shell's root listener as the sole
 * keydown owner (§6.3).
 *
 * Resume seeding and progress reporting are unchanged in effect: seeding now
 * runs through the player's own `startTime` input (`HtmlVideoElementSession`)
 * instead of a manual `loadedmetadata` listener, and progress reporting
 * reads the same `WebVideoControlsAdapter.state()` signal the previous
 * bare-`<video>` overlay read, just sourced from the mounted player instead
 * of a directly-provided adapter.
 */
@Component({
    selector: 'lib-tv-web-engine',
    imports: [
        HtmlVideoPlayerComponent,
        TranslateModule,
        TvCatalogStateComponent,
        TvPlayerControlsComponent,
    ],
    templateUrl: './tv-web-engine.component.html',
    styleUrl: './tv-web-engine.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: WEB_PLAYER_SHARED_CONTROLS, useValue: true }],
    host: { class: 'tv-web-engine' },
})
export class TvWebEngineComponent {
    private readonly focusService = inject(TvFocusService);

    readonly streamUrl = input.required<string>();
    readonly resumeSeconds = input(0);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);
    readonly isOverlayActive = input(false);

    readonly playbackProgress = output<{
        positionSeconds: number;
        durationSeconds: number | null;
    }>();
    readonly channelChangeRequested = output<'up' | 'down'>();
    readonly openChannelBarRequested = output<void>();
    readonly overlayBackRequested = output<void>();
    readonly exited = output<void>();

    protected readonly htmlPlayer = viewChild.required(HtmlVideoPlayerComponent);
    /**
     * Bumped by {@link onRetry} to force `channel()` to recompute even when
     * `streamUrl()` itself has not changed. `buildTvWebEngineChannel()`
     * always returns a fresh object literal, so a recompute is a reference
     * change on the `[channel]` input — which is exactly what
     * `HtmlVideoPlayerComponent.ngOnChanges()` checks to decide whether to
     * re-run `playChannel()` (see its `changes['channel']` branch). Reading
     * `channel()` again without bumping this would return the same cached
     * computed value and never re-trigger playback.
     */
    private readonly retryToken = signal(0);
    protected readonly channel = computed(() => {
        this.retryToken();
        return buildTvWebEngineChannel(this.streamUrl());
    });
    protected readonly playerSurface = computed(
        () => this.htmlPlayer().playerRoot()?.nativeElement ?? null
    );
    protected readonly playbackIssue = signal<PlaybackDiagnostic | null>(null);
    protected readonly errorDescriptionKey = computed(() => {
        const issue = this.playbackIssue();
        return issue ? tvPlaybackDiagnosticDescriptionKey(issue) : null;
    });
    protected readonly retryGroupId = PLAYBACK_ERROR_RETRY_GROUP_ID;

    private lastReportedSecond = -1;

    constructor() {
        effect(() => {
            const state = this.htmlPlayer().controlsAdapter.state();
            const position = Math.floor(state.positionSeconds);
            const isReportBoundary =
                position !== this.lastReportedSecond &&
                position % PROGRESS_REPORT_INTERVAL_SECONDS === 0;
            if (state.status === 'playing' && isReportBoundary) {
                this.lastReportedSecond = position;
                this.playbackProgress.emit({
                    positionSeconds: state.positionSeconds,
                    durationSeconds: state.durationSeconds,
                });
            }
        });

        // The error state's Retry registers its own `tvFocusGroup`
        // (`TvCatalogStateComponent`), but registering a group never makes
        // it active on its own (§6.4) — without this, real DOM focus and
        // `TvFocusService.activeElement()` both stay on whatever the
        // underlying screen (e.g. the detail page's Play button) had
        // focused before playback started, so OK does nothing and the
        // visibly-rendered Retry is unreachable. `queueMicrotask()` matches
        // the established pattern elsewhere in this shell (catalogue/home/
        // search/detail/source-picker): `TvFocusGroupDirective.ngOnInit()`
        // registers the group on the SAME change-detection pass this effect
        // first sees `errorDescriptionKey()` turn truthy, and effects flush
        // before Angular applies that pass, so `setActive()` called
        // synchronously here would race an as-yet-unregistered group.
        effect(() => {
            if (this.errorDescriptionKey()) {
                queueMicrotask(() =>
                    this.focusService.setActive(this.retryGroupId, 0)
                );
            }
        });
    }

    protected onPlaybackIssue(issue: PlaybackDiagnostic | null): void {
        this.playbackIssue.set(issue);
    }

    /**
     * Forces `HtmlVideoPlayerComponent` to re-attempt the current stream by
     * bumping {@link retryToken}. See the field doc on `channel` for why a
     * mere re-read is not enough. `playbackIssue` is not cleared here: the
     * player itself emits `null` synchronously from `playChannel()` once the
     * new `channel` input lands (see its `changes['channel']` branch), and a
     * stream that keeps failing must keep showing the error rather than
     * flash it away optimistically.
     */
    protected onRetry(): void {
        this.retryToken.update((token) => token + 1);
    }
}
