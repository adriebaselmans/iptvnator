import {
    buildTvCategoryRailItems,
    resolveTvCatalogItemId,
    toTvCatalogDetailType,
    toTvPosterGridItem,
    toTvXtreamPlaylistData,
} from './tv-catalog-screen.util';

describe('toTvCatalogDetailType', () => {
    it('maps vod to movie', () => {
        expect(toTvCatalogDetailType('vod')).toBe('movie');
    });

    it('maps series to series', () => {
        expect(toTvCatalogDetailType('series')).toBe('series');
    });
});

describe('resolveTvCatalogItemId', () => {
    it('prefers stream_id for VOD items', () => {
        expect(resolveTvCatalogItemId({ stream_id: 42, id: 1 })).toBe(42);
    });

    it('falls back to series_id for series items', () => {
        expect(resolveTvCatalogItemId({ series_id: 7 })).toBe(7);
    });

    it('falls back to id when neither is present', () => {
        expect(resolveTvCatalogItemId({ id: 'abc' })).toBe('abc');
    });
});

describe('toTvPosterGridItem', () => {
    it('maps a VOD stream, preferring stream_icon for the poster', () => {
        expect(
            toTvPosterGridItem({
                stream_id: 1,
                name: 'A Movie',
                stream_icon: 'http://example.test/poster.jpg',
            })
        ).toEqual({
            id: 1,
            title: 'A Movie',
            posterUrl: 'http://example.test/poster.jpg',
        });
    });

    it('maps a series item, preferring cover for the poster', () => {
        expect(
            toTvPosterGridItem({
                series_id: 2,
                name: 'A Series',
                cover: 'http://example.test/cover.jpg',
            })
        ).toEqual({
            id: 2,
            title: 'A Series',
            posterUrl: 'http://example.test/cover.jpg',
        });
    });

    it('prefers an explicit poster_url over cover/stream_icon', () => {
        expect(
            toTvPosterGridItem({
                stream_id: 1,
                name: 'A Movie',
                poster_url: 'http://example.test/tmdb.jpg',
                stream_icon: 'http://example.test/icon.jpg',
            })
        ).toEqual({
            id: 1,
            title: 'A Movie',
            posterUrl: 'http://example.test/tmdb.jpg',
        });
    });

    it('leaves posterUrl undefined when no artwork field is present', () => {
        expect(toTvPosterGridItem({ stream_id: 1, name: 'No Art' })).toEqual({
            id: 1,
            title: 'No Art',
            posterUrl: undefined,
        });
    });

    it('returns null when there is no resolvable id', () => {
        expect(toTvPosterGridItem({ name: 'Missing id' })).toBeNull();
    });

    it('returns null when there is no title', () => {
        expect(toTvPosterGridItem({ stream_id: 1 })).toBeNull();
    });
});

describe('buildTvCategoryRailItems', () => {
    it('prepends an "All" entry with the summed count', () => {
        const items = buildTvCategoryRailItems(
            [
                { category_id: '1', category_name: 'Action' },
                { category_id: '2', category_name: 'Comedy' },
            ],
            new Map([
                [1, 10],
                [2, 5],
            ]),
            'All'
        );

        expect(items).toEqual([
            { id: null, label: 'All', count: 15 },
            { id: 1, label: 'Action', count: 10 },
            { id: 2, label: 'Comedy', count: 5 },
        ]);
    });

    it('skips a category with a non-numeric id', () => {
        const items = buildTvCategoryRailItems(
            [{ category_id: 'not-a-number', category_name: 'Broken' }],
            new Map(),
            'All'
        );

        expect(items).toEqual([{ id: null, label: 'All', count: 0 }]);
    });
});

describe('toTvXtreamPlaylistData', () => {
    it('converts a well-formed Xtream playlist meta', () => {
        expect(
            toTvXtreamPlaylistData({
                _id: 'p1',
                title: 'My Source',
                serverUrl: 'http://example.test',
                username: 'user',
                password: 'pass',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
        ).toEqual({
            id: 'p1',
            name: 'My Source',
            title: 'My Source',
            updateDate: undefined,
            serverUrl: 'http://example.test',
            username: 'user',
            password: 'pass',
            type: 'xtream',
        });
    });

    it('returns null when required connection fields are missing', () => {
        expect(
            toTvXtreamPlaylistData({
                _id: 'p1',
                serverUrl: 'http://example.test',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
        ).toBeNull();
    });

    it('returns null for a null playlist', () => {
        expect(toTvXtreamPlaylistData(null)).toBeNull();
    });
});
