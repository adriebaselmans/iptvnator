import type { FocusDirection } from '@iptvnator/ui/tv-navigation';

/**
 * The six-key remote vocabulary (§6.1 of the TV shell design), translated
 * from a `KeyboardEvent.key` into a navigation intent. Pure and DOM-free so
 * the mapping is exhaustively unit-testable without a `TestBed`.
 *
 * Remotes disagree on which code Back sends, so both `Backspace` and
 * `Escape` map to it. Every other key returns `null` and is left alone by
 * the caller (no `preventDefault`), since the vocabulary is deliberately the
 * only floor: nothing else is a valid TV input.
 */
export type TvKeyIntent =
    | { readonly kind: 'move'; readonly direction: FocusDirection }
    | { readonly kind: 'activate' }
    | { readonly kind: 'back' };

const DIRECTION_BY_KEY: Readonly<Record<string, FocusDirection>> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

export function mapTvKeyToIntent(key: string): TvKeyIntent | null {
    const direction = DIRECTION_BY_KEY[key];
    if (direction) {
        return { kind: 'move', direction };
    }

    if (key === 'Enter') {
        return { kind: 'activate' };
    }

    if (key === 'Backspace' || key === 'Escape') {
        return { kind: 'back' };
    }

    return null;
}
