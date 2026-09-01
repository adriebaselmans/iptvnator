import {
    buildTvKeyboardKeys,
    TV_KEYBOARD_COLUMN_COUNT,
} from './tv-keyboard.util';

describe('buildTvKeyboardKeys', () => {
    it('builds 10 digits, 26 letters, and 3 special keys', () => {
        const keys = buildTvKeyboardKeys();
        expect(keys.filter((key) => key.kind === 'char').length).toBe(36);
        expect(keys.filter((key) => key.kind === 'space').length).toBe(1);
        expect(keys.filter((key) => key.kind === 'backspace').length).toBe(1);
        expect(keys.filter((key) => key.kind === 'clear').length).toBe(1);
        expect(keys.length).toBe(39);
    });

    it('every id is unique', () => {
        const keys = buildTvKeyboardKeys();
        expect(new Set(keys.map((key) => key.id)).size).toBe(keys.length);
    });

    it('char keys carry a lowercase value and uppercase label', () => {
        const keys = buildTvKeyboardKeys();
        const a = keys.find((key) => key.id === 'char-a');
        expect(a?.value).toBe('a');
        expect(a?.label).toBe('A');
    });

    it('the column count does not evenly divide the key count, exercising a ragged last row', () => {
        const keys = buildTvKeyboardKeys();
        expect(keys.length % TV_KEYBOARD_COLUMN_COUNT).not.toBe(0);
    });
});
