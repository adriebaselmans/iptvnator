import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    input,
    output,
    viewChild,
} from '@angular/core';
import {
    HtmlVideoPlayerComponent,
    type PlayerMediaTitle,
    WEB_PLAYER_SHARED_CONTROLS,
} from '@iptvnator/ui/playback';
import { TvPlayerControlsComponent } from './tv-player-controls.component';
import { buildTvWebEngineChannel } from './tv-web-engine-channel.util';

/** How often a still-playing session reports progress for position persistence. */
const PROGRESS_REPORT_INTERVAL_SECONDS = 5;

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
    imports: [HtmlVideoPlayerComponent, TvPlayerControlsComponent],
    templateUrl: './tv-web-engine.component.html',
    styleUrl: './tv-web-engine.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: WEB_PLAYER_SHARED_CONTROLS, useValue: true }],
    host: { class: 'tv-web-engine' },
})
export class TvWebEngineComponent {
    readonly streamUrl = input.required<string>();
    readonly resumeSeconds = input(0);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);

    readonly playbackProgress = output<{
        positionSeconds: number;
        durationSeconds: number | null;
    }>();
    readonly exited = output<void>();

    protected readonly htmlPlayer = viewChild.required(HtmlVideoPlayerComponent);
    protected readonly channel = computed(() =>
        buildTvWebEngineChannel(this.streamUrl())
    );
    protected readonly playerSurface = computed(
        () => this.htmlPlayer().playerRoot()?.nativeElement ?? null
    );

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
    }
}
