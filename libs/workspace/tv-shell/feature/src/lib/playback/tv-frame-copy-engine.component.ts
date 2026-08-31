import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    computed,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import {
    EmbeddedMpvOverlayVisibilityService,
    EmbeddedMpvPlayerComponent,
    type PlayerMediaTitle,
} from '@iptvnator/ui/playback';
import { TvPlayerControlsComponent } from './tv-player-controls.component';

/** How often a still-playing session reports progress for position persistence. */
const PROGRESS_REPORT_INTERVAL_SECONDS = 5;

/**
 * The frame-copy branch of the §9.1b engine chain — the only branch that
 * carries the full catalogue (MKV, raw MPEG-TS included), because it renders
 * into an ordinary `<canvas>` instead of compositing a child window above
 * the DOM the way native-view does. Mounted only once `TvPlaybackOverlayComponent`
 * has confirmed frame-copy is genuinely available via the runtime probe —
 * this component never guesses.
 *
 * `EmbeddedMpvPlayerComponent` always mounts its own `app-player-controls`
 * while the frame-copy engine is active, wired to `ControlsShortcuts` via an
 * internal `sharedShortcutsEnabled = !overlayActive` computation with no
 * input to override it directly (unlike `HtmlVideoPlayerComponent`'s
 * `interactionEnabled`). `showControls=false` hides it, but does not disarm
 * its shortcuts — those still attach a document-level keydown listener,
 * which would double-handle every remote key exactly like Phase 4's
 * `app-player-controls` trap. `EmbeddedMpvOverlayVisibilityService` is the
 * component's own published mechanism for this: registering as an external
 * modal surface (`acquireExternalModalSurface()`, the same call the
 * workspace's phone context drawer uses) forces `overlayActive` true for as
 * long as this component is mounted, which is exactly what disables those
 * shortcuts. This is consuming a published service, not modifying
 * `libs/ui/playback` (§9.1a/§5.5). `TvPlayerControlsComponent`, driven by the
 * player's own public `sharedControls` adapter, is the actual controls
 * surface, matching the web-engine branch.
 */
@Component({
    selector: 'lib-tv-frame-copy-engine',
    imports: [EmbeddedMpvPlayerComponent, TvPlayerControlsComponent],
    templateUrl: './tv-frame-copy-engine.component.html',
    styleUrl: './tv-frame-copy-engine.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-frame-copy-engine' },
})
export class TvFrameCopyEngineComponent implements OnDestroy {
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

    protected readonly mpvPlayer = viewChild.required(EmbeddedMpvPlayerComponent);
    protected readonly playback = computed<ResolvedPortalPlayback>(() => ({
        streamUrl: this.streamUrl(),
        title: this.mediaTitle()?.primary ?? '',
        isLive: this.isLive(),
        startTime: this.resumeSeconds(),
    }));

    private readonly overlayVisibility = inject(EmbeddedMpvOverlayVisibilityService);
    private readonly releaseModalSurface: () => void;
    private lastReportedSecond = -1;

    constructor() {
        this.releaseModalSurface =
            this.overlayVisibility.acquireExternalModalSurface();
    }

    ngOnDestroy(): void {
        this.releaseModalSurface();
    }

    protected onTimeUpdate(event: {
        currentTime: number;
        duration: number;
    }): void {
        const position = Math.floor(event.currentTime);
        const isReportBoundary =
            position !== this.lastReportedSecond &&
            position % PROGRESS_REPORT_INTERVAL_SECONDS === 0;
        if (this.mpvPlayer().isPlaying() && isReportBoundary) {
            this.lastReportedSecond = position;
            this.playbackProgress.emit({
                positionSeconds: event.currentTime,
                durationSeconds: event.duration || null,
            });
        }
    }
}
