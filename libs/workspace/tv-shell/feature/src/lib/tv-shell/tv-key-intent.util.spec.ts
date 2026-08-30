import { mapTvKeyToIntent } from './tv-key-intent.util';

describe('mapTvKeyToIntent', () => {
    it.each([
        ['ArrowUp', 'up'],
        ['ArrowDown', 'down'],
        ['ArrowLeft', 'left'],
        ['ArrowRight', 'right'],
    ] as const)('maps %s to a move intent in direction %s', (key, direction) => {
        expect(mapTvKeyToIntent(key)).toEqual({ kind: 'move', direction });
    });

    it('maps Enter to an activate intent', () => {
        expect(mapTvKeyToIntent('Enter')).toEqual({ kind: 'activate' });
    });

    it.each(['Backspace', 'Escape'])(
        'maps %s to a back intent',
        (key) => {
            expect(mapTvKeyToIntent(key)).toEqual({ kind: 'back' });
        }
    );

    it.each(['a', 'Tab', ' ', 'F5', 'MediaPlayPause', ''])(
        'returns null for %s, the unhandled vocabulary',
        (key) => {
            expect(mapTvKeyToIntent(key)).toBeNull();
        }
    );
});
