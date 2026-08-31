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
    /** Live-only: Up/Down change channel directly (§7.3). */
    readonly onChannelChange?: (direction: 'up' | 'down') => void;
    readonly onExit: () => void;
    /**
     * Live-only: OK opens the channel bar instead of toggling play/pause
     * (§7.3). Unset for VOD sessions, where OK keeps its §9.2 meaning.
     */
    readonly onOpenChannelBar?: () => void;
    /**
     * True while a shell-owned overlay the session mounted (channel bar,
     * category column, EPG grid) has claimed the key stream (§6.3: "Overlays
     * and modals claim the intent stream while open"). While true, the
     * shell routes keys through ordinary focus intents (move/activate)
     * instead of playback intents, and Back closes the overlay via
     * `onOverlayBack` instead of exiting playback. Absent/false for sessions
     * with no such overlay (VOD).
     */
    readonly isOverlayActive?: () => boolean;
    /** Closes the currently open overlay (§7.3 "Back closes"). */
    readonly onOverlayBack?: () => void;
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
