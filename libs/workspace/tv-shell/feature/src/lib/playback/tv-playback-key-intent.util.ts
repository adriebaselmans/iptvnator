export type TvPlaybackKeyIntent =
    | { readonly kind: 'toggle-play' }
    | { readonly kind: 'seek'; readonly deltaSeconds: number }
    | { readonly kind: 'channel'; readonly direction: 'up' | 'down' }
    | { readonly kind: 'open-channel-bar' }
    | { readonly kind: 'exit' };

const SEEK_STEP_SECONDS = 10;

/**
 * Playback transport mapping (§9.2/§7.3 of the design doc). Pure and
 * DOM-free, mirroring `tv-key-intent.util.ts`'s focus mapping so the same
 * six-key vocabulary behaves differently only while a playback session owns
 * the keys (§6.3: the shell owns key handling; screens and controls attach
 * no listeners of their own).
 *
 * Live playback maps Up/Down to channel changes instead of seeking, and OK
 * to opening the channel bar instead of toggling play/pause (§7.3 — Phase 4b
 * left Enter mapped to `toggle-play` for live too, since no channel bar
 * existed yet to open; this phase corrects it). Left/Right are deliberately
 * unmapped here for live: §7.3 routes them to the channel bar's category
 * column and EPG grid, which only exist once the channel bar has claimed the
 * key stream (`TvPlaybackSession.isOverlayActive`) — at that point the shell
 * stops calling this mapper at all and routes through ordinary focus intents
 * instead (§6.3 "overlays claim the intent stream while open").
 */
export function mapTvPlaybackKeyToIntent(
    key: string,
    isLive: boolean
): TvPlaybackKeyIntent | null {
    if (key === 'Backspace' || key === 'Escape') {
        return { kind: 'exit' };
    }

    if (isLive) {
        if (key === 'Enter') return { kind: 'open-channel-bar' };
        if (key === 'ArrowUp') return { kind: 'channel', direction: 'up' };
        if (key === 'ArrowDown') return { kind: 'channel', direction: 'down' };
        return null;
    }

    if (key === 'Enter') {
        return { kind: 'toggle-play' };
    }
    if (key === 'ArrowLeft') {
        return { kind: 'seek', deltaSeconds: -SEEK_STEP_SECONDS };
    }
    if (key === 'ArrowRight') {
        return { kind: 'seek', deltaSeconds: SEEK_STEP_SECONDS };
    }

    return null;
}
