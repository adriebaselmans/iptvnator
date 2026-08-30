import { computeTvGridColumnCount } from './tv-grid-columns.util';

describe('computeTvGridColumnCount', () => {
    it('resolves to six columns at a 1080p (1920px) viewport width', () => {
        expect(computeTvGridColumnCount(1920)).toBe(6);
    });

    it('resolves to fewer columns on a narrower viewport', () => {
        expect(computeTvGridColumnCount(1280)).toBe(4);
    });

    it('resolves to more columns on a wider (4K) viewport', () => {
        expect(computeTvGridColumnCount(3840)).toBe(12);
    });

    it('never drops below the minimum column count', () => {
        expect(computeTvGridColumnCount(100)).toBe(2);
        expect(computeTvGridColumnCount(0)).toBe(2);
        expect(computeTvGridColumnCount(-50)).toBe(2);
    });

    it('falls back to the minimum for a non-finite width', () => {
        expect(computeTvGridColumnCount(Number.NaN)).toBe(2);
        expect(computeTvGridColumnCount(Number.POSITIVE_INFINITY)).toBe(2);
    });

    it('honours custom card/gap/minimum overrides', () => {
        expect(computeTvGridColumnCount(1000, 200, 20, 1)).toBe(4);
        expect(computeTvGridColumnCount(50, 200, 20, 3)).toBe(3);
    });
});
