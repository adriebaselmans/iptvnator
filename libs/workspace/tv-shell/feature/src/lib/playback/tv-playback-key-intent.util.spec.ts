import { mapTvPlaybackKeyToIntent } from './tv-playback-key-intent.util';

describe('mapTvPlaybackKeyToIntent', () => {
    it('maps Enter to toggle-play regardless of live/VOD', () => {
        expect(mapTvPlaybackKeyToIntent('Enter', false)).toEqual({
            kind: 'toggle-play',
        });
        expect(mapTvPlaybackKeyToIntent('Enter', true)).toEqual({
            kind: 'toggle-play',
        });
    });

    it.each(['Backspace', 'Escape'])('%s exits playback', (key) => {
        expect(mapTvPlaybackKeyToIntent(key, false)).toEqual({ kind: 'exit' });
    });

    it('maps Left/Right to seek during VOD playback', () => {
        expect(mapTvPlaybackKeyToIntent('ArrowLeft', false)).toEqual({
            kind: 'seek',
            deltaSeconds: -10,
        });
        expect(mapTvPlaybackKeyToIntent('ArrowRight', false)).toEqual({
            kind: 'seek',
            deltaSeconds: 10,
        });
    });

    it('refuses to map Left/Right to seek during live playback', () => {
        expect(mapTvPlaybackKeyToIntent('ArrowLeft', true)).toBeNull();
        expect(mapTvPlaybackKeyToIntent('ArrowRight', true)).toBeNull();
    });

    it('maps Up/Down to channel change during live playback', () => {
        expect(mapTvPlaybackKeyToIntent('ArrowUp', true)).toEqual({
            kind: 'channel',
            direction: 'up',
        });
        expect(mapTvPlaybackKeyToIntent('ArrowDown', true)).toEqual({
            kind: 'channel',
            direction: 'down',
        });
    });

    it('does not map Up/Down during VOD playback', () => {
        expect(mapTvPlaybackKeyToIntent('ArrowUp', false)).toBeNull();
        expect(mapTvPlaybackKeyToIntent('ArrowDown', false)).toBeNull();
    });

    it('ignores keys outside the six-key vocabulary', () => {
        expect(mapTvPlaybackKeyToIntent('a', false)).toBeNull();
        expect(mapTvPlaybackKeyToIntent('Tab', true)).toBeNull();
    });
});
