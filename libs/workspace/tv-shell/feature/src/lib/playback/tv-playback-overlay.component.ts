import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { VideoPlayer } from '@iptvnator/shared/interfaces';
import type { PlayerMediaTitle } from '@iptvnator/ui/playback';
import { isEmbeddedMpvFrameCopyAvailable } from './tv-embedded-mpv-support.util';
import { TvFrameCopyEngineComponent } from './tv-frame-copy-engine.component';
import { resolveTvPlayerOverride } from './tv-player-override';
import { TvWebEngineComponent } from './tv-web-engine.component';

/**
 * TV mode's playback host, implementing the engine chain decided in §9.1b:
 * Embedded MPV frame-copy when it is genuinely available, `HtmlVideoPlayerComponent`
 * otherwise. Availability is asked once per mount, the same way
 * `EmbeddedMpvSessionController` asks it
 * (`isEmbeddedMpvFrameCopyAvailable` — a runtime probe, never a settings
 * flag), and the result is fed through the existing `resolveTvPlayerOverride()`
 * policy so its native-view/external-player exclusions stay the single
 * source of truth rather than being re-derived here. Resolution starts
 * pinned to the web engine so there is never a dead screen while the probe
 * is in flight or if it fails (fail-closed, §9.1b).
 *
 * The resolved engine is surfaced in a small unobtrusive badge — "why does
 * this not play" is unanswerable from the couch otherwise.
 */
@Component({
    selector: 'lib-tv-playback-overlay',
    imports: [TranslateModule, TvFrameCopyEngineComponent, TvWebEngineComponent],
    templateUrl: './tv-playback-overlay.component.html',
    styleUrl: './tv-playback-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-playback-overlay' },
})
export class TvPlaybackOverlayComponent {
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

    private readonly resolvedPlayer = signal<VideoPlayer>(
        VideoPlayer.Html5Player
    );
    protected readonly isFrameCopyEngine = computed(
        () => this.resolvedPlayer() === VideoPlayer.EmbeddedMpv
    );
    protected readonly engineLabelKey = computed(() =>
        this.isFrameCopyEngine()
            ? 'TV.PLAYBACK.ENGINE_FRAME_COPY'
            : 'TV.PLAYBACK.ENGINE_WEB'
    );

    constructor() {
        void isEmbeddedMpvFrameCopyAvailable(window.electron).then(
            (available) => {
                this.resolvedPlayer.set(
                    resolveTvPlayerOverride(VideoPlayer.EmbeddedMpv, available)
                );
            }
        );
    }

    protected onPlaybackProgress(progress: {
        positionSeconds: number;
        durationSeconds: number | null;
    }): void {
        this.playbackProgress.emit(progress);
    }

    protected onExited(): void {
        this.exited.emit();
    }
}
