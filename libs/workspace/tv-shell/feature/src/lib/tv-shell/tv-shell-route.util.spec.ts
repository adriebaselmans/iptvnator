import { isTvHomeRoute } from './tv-shell-route.util';

describe('isTvHomeRoute', () => {
    it('matches the home route for any playlist id', () => {
        expect(isTvHomeRoute('/tv/xtreams/abc-123/home')).toBe(true);
        expect(
            isTvHomeRoute('/tv/xtreams/5563938c-cf04-4352-a2e9-0d1cb2285314/home')
        ).toBe(true);
    });

    it('matches with a trailing query string or fragment', () => {
        expect(isTvHomeRoute('/tv/xtreams/abc/home?x=1')).toBe(true);
        expect(isTvHomeRoute('/tv/xtreams/abc/home#section')).toBe(true);
    });

    it('does not match other TV screens', () => {
        expect(isTvHomeRoute('/tv/xtreams/abc/live')).toBe(false);
        expect(isTvHomeRoute('/tv/xtreams/abc/movies')).toBe(false);
        expect(isTvHomeRoute('/tv/xtreams/abc/search')).toBe(false);
        expect(
            isTvHomeRoute('/tv/xtreams/abc/detail/movie/100')
        ).toBe(false);
    });

    it('does not match a route that merely contains "home" as a substring', () => {
        expect(isTvHomeRoute('/tv/xtreams/abc/homepage')).toBe(false);
    });

    it('does not match the desktop workspace or the bare TV root', () => {
        expect(isTvHomeRoute('/workspace/dashboard')).toBe(false);
        expect(isTvHomeRoute('/tv')).toBe(false);
    });
});
