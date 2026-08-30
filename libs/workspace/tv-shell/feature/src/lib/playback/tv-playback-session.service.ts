import { Injectable, signal } from '@angular/core';
import type { PlayerController } from '@iptvnator/ui/playback';

/**
 * What `TvPlayerControlsComponent` registers while a playback session is
 * mounted. The shell's root keydown listener reads this to route transport
 * keys to the controller instead of focus navigation (§6.3/§9.2) — nothing
 * else in the shell holds this reference, mirroring how `TvFocusService` is
 * the sole authority for the active focus element.
 */
export interface TvPlaybackSession {
    readonly controller: PlayerController;
    readonly isLive: () => boolean;
    /** Reveals the mounted `app-player-controls` bar (OK reveals controls). */
    readonly reveal: () => void;
    /** Live-only; unset in this phase since no live screen exists yet (Phase 5). */
    readonly onChannelChange?: (direction: 'up' | 'down') => void;
    readonly onExit: () => void;
}

/**
 * Holds the currently mounted playback session. `TvPlayerControlsComponent`
 * registers itself for its lifetime; `TvShellComponent` checks `active()` on
 * every keydown before falling back to ordinary focus-intent mapping.
 */
@Injectable({ providedIn: 'root' })
export class TvPlaybackSessionService {
    private readonly session = signal<TvPlaybackSession | null>(null);
    readonly active = this.session.asReadonly();

    /** Returns an unregister function; safe to call more than once. */
    register(session: TvPlaybackSession): () => void {
        this.session.set(session);
        return () => {
            if (this.session() === session) {
                this.session.set(null);
            }
        };
    }
}
