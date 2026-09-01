import type { CatalogTitleMatch } from '@iptvnator/shared/interfaces';
import {
    buildTvHomeLayout,
    buildTvHomeNeighbourChain,
    toTvHomeHero,
    toTvHomeMatchedRailItem,
    toTvHomeRailItem,
    tvHomeRailGroupId,
    tvHomeRailTitleKey,
    TV_HOME_HERO_GROUP_ID,
    type TvHomeNavigableRailItem,
    type TvHomeSourceItem,
} from './tv-home-screen.util';

const PLAYLIST_ID = 'pl-1';

function sourceItem(overrides: Partial<TvHomeSourceItem> = {}): TvHomeSourceItem {
    return {
        id: 1,
        title: 'Dune',
        type: 'movie',
        playlist_id: PLAYLIST_ID,
        xtream_id: 42,
        poster_url: 'https://example.com/poster.jpg',
        ...overrides,
    };
}

describe('toTvHomeRailItem', () => {
    it('maps a movie item to the movie detail route', () => {
        const item = toTvHomeRailItem(sourceItem(), PLAYLIST_ID, 'cw');
        expect(item?.route).toEqual([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'movie',
            '42',
        ]);
        expect(item?.kind).toBe('movie');
    });

    it('maps a series item to the series detail route', () => {
        const item = toTvHomeRailItem(
            sourceItem({ type: 'series', xtream_id: 7 }),
            PLAYLIST_ID,
            'cw'
        );
        expect(item?.route).toEqual([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'series',
            '7',
        ]);
    });

    it('maps a live item to the live screen route', () => {
        const item = toTvHomeRailItem(
            sourceItem({ type: 'live' }),
            PLAYLIST_ID,
            'live'
        );
        expect(item?.route).toEqual(['/tv', 'xtreams', PLAYLIST_ID, 'live']);
    });

    it('returns null for an item belonging to a different playlist', () => {
        const item = toTvHomeRailItem(
            sourceItem({ playlist_id: 'other' }),
            PLAYLIST_ID,
            'cw'
        );
        expect(item).toBeNull();
    });

    it('produces a prefix-scoped id so the same item cannot collide across rails', () => {
        const item = toTvHomeRailItem(sourceItem(), PLAYLIST_ID, 'fav');
        expect(item?.id).toBe('fav-1');
    });
});

function match(overrides: Partial<CatalogTitleMatch> = {}): CatalogTitleMatch {
    return {
        queryTitle: 'Dune',
        playlistId: PLAYLIST_ID,
        playlistName: 'My Source',
        categoryId: 1,
        xtreamId: 99,
        type: 'movie',
        ...overrides,
    } as CatalogTitleMatch;
}

describe('toTvHomeMatchedRailItem', () => {
    it('maps a matched trending/recommendation entry to its detail route', () => {
        const item = toTvHomeMatchedRailItem(
            { title: 'Dune', posterUrl: 'poster.jpg', match: match() },
            PLAYLIST_ID,
            'trend'
        );
        expect(item?.route).toEqual([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'movie',
            '99',
        ]);
    });

    it('returns null when the match belongs to a different playlist', () => {
        const item = toTvHomeMatchedRailItem(
            { title: 'Dune', posterUrl: null, match: match({ playlistId: 'other' }) },
            PLAYLIST_ID,
            'trend'
        );
        expect(item).toBeNull();
    });
});

describe('toTvHomeHero', () => {
    it('builds hero data for a movie item', () => {
        const hero = toTvHomeHero(
            {
                title: 'Dune',
                type: 'movie',
                playlist_id: PLAYLIST_ID,
                xtream_id: 42,
                backdrop_url: 'backdrop.jpg',
            },
            PLAYLIST_ID
        );
        expect(hero).toEqual({
            title: 'Dune',
            backdropUrl: 'backdrop.jpg',
            route: ['/tv', 'xtreams', PLAYLIST_ID, 'detail', 'movie', '42'],
        });
    });

    it('falls back to the poster when there is no backdrop', () => {
        const hero = toTvHomeHero(
            {
                title: 'Dune',
                type: 'movie',
                playlist_id: PLAYLIST_ID,
                xtream_id: 42,
                poster_url: 'poster.jpg',
            },
            PLAYLIST_ID
        );
        expect(hero?.backdropUrl).toBe('poster.jpg');
    });

    it('returns null for a live item — resume never applies to live', () => {
        const hero = toTvHomeHero(
            {
                title: 'News',
                type: 'live',
                playlist_id: PLAYLIST_ID,
                xtream_id: 1,
            },
            PLAYLIST_ID
        );
        expect(hero).toBeNull();
    });

    it('returns null when there is no item', () => {
        expect(toTvHomeHero(undefined, PLAYLIST_ID)).toBeNull();
    });
});

describe('buildTvHomeNeighbourChain', () => {
    it('chains groups in order with up/down neighbours', () => {
        const chain = buildTvHomeNeighbourChain(['a', 'b', 'c']);
        expect(chain.get('a')).toEqual({ down: 'b' });
        expect(chain.get('b')).toEqual({ up: 'a', down: 'c' });
        expect(chain.get('c')).toEqual({ up: 'b' });
    });

    it('a single group has no neighbours', () => {
        const chain = buildTvHomeNeighbourChain(['only']);
        expect(chain.get('only')).toEqual({});
    });

    it('an empty list produces an empty chain', () => {
        expect(buildTvHomeNeighbourChain([]).size).toBe(0);
    });
});

describe('tvHomeRailGroupId / tvHomeRailTitleKey', () => {
    it('produces a stable, kind-scoped group id', () => {
        expect(tvHomeRailGroupId('continue-watching')).toBe(
            'tv-home-rail-continue-watching'
        );
    });

    it('never collides with the hero group id', () => {
        expect(tvHomeRailGroupId('continue-watching')).not.toBe(
            TV_HOME_HERO_GROUP_ID
        );
    });

    it('resolves a title key for every rail kind', () => {
        const kinds: Array<Parameters<typeof tvHomeRailTitleKey>[0]> = [
            'continue-watching',
            'recently-added',
            'favourites',
            'live-now',
            'trending',
            'recommendations',
        ];
        for (const kind of kinds) {
            expect(tvHomeRailTitleKey(kind)).toMatch(/^TV\.HOME\./);
        }
    });
});

function railItem(id: string): TvHomeNavigableRailItem {
    return { id, title: id, route: [] };
}

describe('buildTvHomeLayout', () => {
    it('drops empty rails entirely and chains only the visible groups', () => {
        const layout = buildTvHomeLayout(true, [
            { kind: 'continue-watching', items: [railItem('a')] },
            { kind: 'recently-added', items: [] },
            { kind: 'favourites', items: [railItem('b')] },
        ]);

        expect(layout.rails.map((rail) => rail.kind)).toEqual([
            'continue-watching',
            'favourites',
        ]);
        expect(layout.heroNeighbours).toEqual({
            down: tvHomeRailGroupId('continue-watching'),
        });
        expect(layout.rails[0].neighbours).toEqual({
            up: TV_HOME_HERO_GROUP_ID,
            down: tvHomeRailGroupId('favourites'),
        });
        expect(layout.rails[1].neighbours).toEqual({
            up: tvHomeRailGroupId('continue-watching'),
        });
    });

    it('has no hero neighbours when there is no hero', () => {
        const layout = buildTvHomeLayout(false, [
            { kind: 'favourites', items: [railItem('a')] },
        ]);
        expect(layout.heroNeighbours).toBeNull();
        expect(layout.rails[0].neighbours).toEqual({});
    });

    it('an all-empty layout with no hero produces no groups', () => {
        const layout = buildTvHomeLayout(false, [
            { kind: 'favourites', items: [] },
        ]);
        expect(layout.rails).toEqual([]);
        expect(layout.heroNeighbours).toBeNull();
    });
});
