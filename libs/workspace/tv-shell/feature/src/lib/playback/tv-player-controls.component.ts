import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import {
    PlayerControlsComponent,
    type PlayerController,
    type PlayerMediaTitle,
} from '@iptvnator/ui/playback';
import { TvPlaybackSessionService } from './tv-playback-session.service';

/**
 * TV mode's playback controls (§9.2 of the design doc). Consumes the same
 * engine-neutral `PlayerController` contract `app-player-controls` consumes
 * — the sanctioned way to reuse its playback diagnostics/recovery, subtitle
 * handling, quality menu, and VOD resume without reimplementing any of it
 * (§5.5 keeps the shell out of player internals otherwise).
 *
 * This component attaches no keydown listener of its own (§6.3): it only
 * registers the mounted controller with `TvPlaybackSessionService` so the
 * shell's single root listener can route transport keys to it. `reveal()` is
 * exposed to the session so OK can reveal the controls bar the way the
 * desktop's own `togglePlay()`/`seekBy()` do internally.
 */
@Component({
    selector: 'lib-tv-player-controls',
    imports: [PlayerControlsComponent],
    templateUrl: './tv-player-controls.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-player-controls' },
})
export class TvPlayerControlsComponent {
    private readonly playbackSession = inject(TvPlaybackSessionService);

    readonly controller = input.required<PlayerController>();
    readonly playerSurface = input<HTMLElement | null>(null);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);

    /** Live-only; nothing consumes this yet (Phase 5 builds the channel bar). */
    readonly channelChangeRequested = output<'up' | 'down'>();
    readonly exited = output<void>();

    private readonly controls = viewChild.required(PlayerControlsComponent);

    constructor() {
        effect((onCleanup) => {
            const controller = this.controller();
            const unregister = this.playbackSession.register({
                controller,
                isLive: () => this.isLive(),
                reveal: () => this.controls().reveal(),
                onChannelChange: (direction) =>
                    this.channelChangeRequested.emit(direction),
                onExit: () => this.exited.emit(),
            });
            onCleanup(unregister);
        });
    }
}
