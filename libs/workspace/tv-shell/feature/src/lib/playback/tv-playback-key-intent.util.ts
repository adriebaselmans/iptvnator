export type TvPlaybackKeyIntent =
    | { readonly kind: 'toggle-play' }
    | { readonly kind: 'seek'; readonly deltaSeconds: number }
    | { readonly kind: 'channel'; readonly direction: 'up' | 'down' }
    | { readonly kind: 'exit' };

const SEEK_STEP_SECONDS = 10;

/**
 * Playback transport mapping (§9.2 of the design doc). Pure and DOM-free,
 * mirroring `tv-key-intent.util.ts`'s focus mapping so the same six-key
 * vocabulary behaves differently only while a playback session owns the
 * keys (§6.3: the shell owns key handling; screens and controls attach no
 * listeners of their own).
 *
 * Live playback maps Up/Down to channel changes instead of seeking
 * (§7.3/§9.2). Left/Right are deliberately unmapped for live in this phase:
 * §7.3 routes them to the channel bar's category column and EPG grid, which
 * is Phase 5 — returning `null` here leaves that door open without building
 * it.
 */
export function mapTvPlaybackKeyToIntent(
    key: string,
    isLive: boolean
): TvPlaybackKeyIntent | null {
    if (key === 'Enter') {
        return { kind: 'toggle-play' };
    }

    if (key === 'Backspace' || key === 'Escape') {
        return { kind: 'exit' };
    }

    if (isLive) {
        if (key === 'ArrowUp') return { kind: 'channel', direction: 'up' };
        if (key === 'ArrowDown') return { kind: 'channel', direction: 'down' };
        return null;
    }

    if (key === 'ArrowLeft') {
        return { kind: 'seek', deltaSeconds: -SEEK_STEP_SECONDS };
    }
    if (key === 'ArrowRight') {
        return { kind: 'seek', deltaSeconds: SEEK_STEP_SECONDS };
    }

    return null;
}
