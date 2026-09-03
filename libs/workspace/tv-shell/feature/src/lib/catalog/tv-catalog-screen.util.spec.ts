import {
    buildTvCategoryRailItems,
    resolveTvCatalogItemId,
    toTvCatalogDetailType,
    toTvPosterGridItem,
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

    // Regression: the Electron DB-first data source hands back the SQLite
    // `content` row shape, which has neither `stream_id` nor `series_id` —
    // only `xtream_id` (the provider id `get_vod_info`/`get_series_info`
    // need) and `id` (the row's own SQLite primary key, meaningless to the
    // provider API). Falling through to `id` here sent the wrong id to the
    // detail screen's provider lookups and produced a blank hero with only
    // the id-independent Favourite action enabled.
    it('prefers xtream_id over the SQLite primary key id (Electron content row shape)', () => {
        expect(resolveTvCatalogItemId({ xtream_id: 42, id: 1 })).toBe(42);
    });

    it('prefers xtream_id over stream_id/series_id when somehow all are present', () => {
        expect(
            resolveTvCatalogItemId({ xtream_id: 42, stream_id: 99, series_id: 100, id: 1 })
        ).toBe(42);
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
