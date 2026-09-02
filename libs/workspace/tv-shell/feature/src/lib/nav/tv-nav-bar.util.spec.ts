import { tvNavRoute, tvNavSections } from './tv-nav-bar.util';

describe('tvNavSections', () => {
    it('lists Home, Live, Movies, Series and Search in that order', () => {
        expect(tvNavSections().map((section) => section.id)).toEqual([
            'home',
            'live',
            'movies',
            'series',
            'search',
        ]);
    });
});

describe('tvNavRoute', () => {
    it('routes home to the /home segment', () => {
        expect(tvNavRoute('home', 'p1')).toEqual([
            '/tv',
            'xtreams',
            'p1',
            'home',
        ]);
    });

    it('routes every other section to its own segment', () => {
        expect(tvNavRoute('movies', 'p1')).toEqual([
            '/tv',
            'xtreams',
            'p1',
            'movies',
        ]);
        expect(tvNavRoute('search', 'p1')).toEqual([
            '/tv',
            'xtreams',
            'p1',
            'search',
        ]);
    });
});
