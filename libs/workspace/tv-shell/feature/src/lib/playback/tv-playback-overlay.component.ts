import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    effect,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import {
    type PlayerMediaTitle,
    WebVideoControlsAdapter,
} from '@iptvnator/ui/playback';
import { TvPlayerControlsComponent } from './tv-player-controls.component';

/** How often a still-playing session reports progress for position persistence. */
const PROGRESS_REPORT_INTERVAL_SECONDS = 5;

/**
 * TV mode's forced playback engine (§9.1/§9.2 of the design doc). A plain
 * `<video>` element bridged onto the shared `PlayerController` contract via
 * `WebVideoControlsAdapter` — the sanctioned way to reach `libs/ui/playback`
 * without consuming a full engine host (§5.5 keeps player internals like
 * `HtmlVideoPlayerComponent`/`EmbeddedMpvPlayerComponent` out of the shell's
 * reach). Xtream VOD and episode URLs are direct progressive-download files
 * (`XtreamUrlService.constructVodUrl`/`constructEpisodeUrl`), so a native
 * `<video src>` plays them without hls.js or Shaka — see
 * `tv-player-override.ts` for the policy this implements one branch of.
 */
@Component({
    selector: 'lib-tv-playback-overlay',
    imports: [TvPlayerControlsComponent],
    templateUrl: './tv-playback-overlay.component.html',
    styleUrl: './tv-playback-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [WebVideoControlsAdapter],
    host: { class: 'tv-playback-overlay' },
})
export class TvPlaybackOverlayComponent implements OnDestroy {
    private readonly hostElement = inject(ElementRef<HTMLElement>).nativeElement;
    protected readonly adapter = inject(WebVideoControlsAdapter);
    private readonly video =
        viewChild.required<ElementRef<HTMLVideoElement>>('video');

    readonly streamUrl = input.required<string>();
    /** Seconds to seed playback at once metadata is available (§9: resume). */
    readonly resumeSeconds = input(0);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);

    readonly playbackProgress = output<{
        positionSeconds: number;
        durationSeconds: number | null;
    }>();
    readonly exited = output<void>();

    protected readonly playerSurface = this.hostElement;

    private lastReportedSecond = -1;

    constructor() {
        effect(() => {
            const url = this.streamUrl();
            const element = this.video().nativeElement;
            if (!url) {
                this.adapter.detach();
                return;
            }

            this.adapter.attach(element);
            if (element.src === url) {
                return;
            }

            element.src = url;
            element.load();
            const resume = this.resumeSeconds();
            if (resume > 0) {
                const seedResume = () => {
                    element.currentTime = resume;
                    element.removeEventListener('loadedmetadata', seedResume);
                };
                element.addEventListener('loadedmetadata', seedResume);
            }
            void element.play().catch(() => undefined);
        });

        effect(() => {
            const state = this.adapter.state();
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

    ngOnDestroy(): void {
        this.adapter.detach();
    }
}
