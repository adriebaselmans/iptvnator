import {
    applyTvKeyboardBackspace,
    applyTvKeyboardChar,
    toTvSearchResultItem,
    toTvSearchResultItems,
    type TvSearchSourceItem,
} from './tv-search-screen.util';

const PLAYLIST_ID = 'p1';

function item(overrides: Partial<TvSearchSourceItem> = {}): TvSearchSourceItem {
    return {
        xtream_id: 42,
        title: 'Dune',
        type: 'movie',
        poster_url: 'poster.jpg',
        ...overrides,
    };
}

describe('toTvSearchResultItem', () => {
    it('maps a movie result to the movie detail route', () => {
        const result = toTvSearchResultItem(item(), PLAYLIST_ID);
        expect(result?.route).toEqual([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'movie',
            '42',
        ]);
    });

    it('maps a series result to the series detail route', () => {
        const result = toTvSearchResultItem(
            item({ type: 'series', xtream_id: 7 }),
            PLAYLIST_ID
        );
        expect(result?.route).toEqual([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'series',
            '7',
        ]);
    });

    it('maps a live result to the live screen route', () => {
        const result = toTvSearchResultItem(
            item({ type: 'live', xtream_id: 5 }),
            PLAYLIST_ID
        );
        expect(result?.route).toEqual(['/tv', 'xtreams', PLAYLIST_ID, 'live']);
    });

    it('falls back to `id` when `xtream_id` is absent', () => {
        const result = toTvSearchResultItem(
            item({ xtream_id: undefined, id: 9 }),
            PLAYLIST_ID
        );
        expect(result?.id).toBe(9);
    });

    it('returns null without a usable id or title', () => {
        expect(
            toTvSearchResultItem(
                item({ xtream_id: undefined, id: undefined }),
                PLAYLIST_ID
            )
        ).toBeNull();
        expect(
            toTvSearchResultItem(item({ title: '' }), PLAYLIST_ID)
        ).toBeNull();
    });
});

describe('toTvSearchResultItems', () => {
    it('drops unmappable entries and keeps the rest in order', () => {
        const results = toTvSearchResultItems(
            [
                item({ xtream_id: 1, title: 'A' }),
                item({ title: '' }),
                item({ xtream_id: 3, title: 'C' }),
            ],
            PLAYLIST_ID
        );
        expect(results.map((r) => r.title)).toEqual(['A', 'C']);
    });
});

describe('applyTvKeyboardChar / applyTvKeyboardBackspace', () => {
    it('appends a character to the current query', () => {
        expect(applyTvKeyboardChar('du', 'n')).toBe('dun');
    });

    it('backspace drops the last character', () => {
        expect(applyTvKeyboardBackspace('dune')).toBe('dun');
    });

    it('backspace on an empty string stays empty', () => {
        expect(applyTvKeyboardBackspace('')).toBe('');
    });
});
