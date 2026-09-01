/**
 * The on-screen keyboard's key model (§7.6). Pure/DOM-free so the layout is
 * unit-testable without a fixture.
 */
export type TvKeyboardKeyKind = 'char' | 'space' | 'backspace' | 'clear';

export interface TvKeyboardKey {
    readonly id: string;
    readonly kind: TvKeyboardKeyKind;
    /** Rendered label for a `char` key (its uppercase form). Ignored for special keys — the component supplies their translated label. */
    readonly label: string;
    /** The character `charEntered` emits for `char`/`space` keys. */
    readonly value?: string;
}

/**
 * Fixed column count for the keyboard's own `grid` focus group (§7.6 — this
 * one IS a constant the code may bake in; only a viewport-derived grid, like
 * the poster grid, may not be).
 */
export const TV_KEYBOARD_COLUMN_COUNT = 10;

/**
 * Digits, then letters, then space/backspace/clear — a fixed layout chosen
 * for this screen, not derived from anything. 39 keys over 10 columns yields
 * 4 rows (10/10/10/9); the grid focus group's ragged-last-row handling
 * (`computeGridDown`) already covers a partial final row.
 */
export function buildTvKeyboardKeys(): readonly TvKeyboardKey[] {
    const digits = '0123456789'.split('');
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const charKeys: TvKeyboardKey[] = [...digits, ...letters].map((char) => ({
        id: `char-${char}`,
        kind: 'char',
        label: char.toUpperCase(),
        value: char,
    }));

    return [
        ...charKeys,
        { id: 'space', kind: 'space', label: ' ', value: ' ' },
        { id: 'backspace', kind: 'backspace', label: '' },
        { id: 'clear', kind: 'clear', label: '' },
    ];
}
