/**
 * The persistent top navigation row shared by Home, the movies/series
 * catalogue and search (design correction #18): a `row` focus group of five
 * entries. Pure/DOM-free by design, mirroring the other `*.util.ts` files —
 * each screen builds its own translated `TvNavBarItem[]` and neighbour
 * wiring from this shared section list rather than duplicating it.
 *
 * Live is deliberately excluded from carrying this same row (see the phase
 * report / `docs/architecture/tv-shell.md`): it is fullscreen playback where
 * OK and Up/Down are already claimed by the live key-intent mapping
 * (§9.2/§7.3), so a competing focus group there would fight the playback
 * session for the key stream. Back already returns to Home in one press.
 */
export type TvNavSectionId = 'home' | 'live' | 'movies' | 'series' | 'search';

export const TV_NAV_GROUP_ID = 'tv-nav-bar';

interface TvNavSectionDef {
    readonly id: TvNavSectionId;
    readonly labelKey: string;
}

const TV_NAV_SECTIONS: readonly TvNavSectionDef[] = [
    { id: 'home', labelKey: 'TV.NAV.HOME' },
    { id: 'live', labelKey: 'TV.NAV.LIVE' },
    { id: 'movies', labelKey: 'TV.NAV.MOVIES' },
    { id: 'series', labelKey: 'TV.NAV.SERIES' },
    { id: 'search', labelKey: 'TV.NAV.SEARCH' },
];

/** The nav row's entries, in display order — id plus untranslated i18n key. */
export function tvNavSections(): readonly TvNavSectionDef[] {
    return TV_NAV_SECTIONS;
}

/** The route a nav entry activates, for this playlist. */
export function tvNavRoute(
    id: TvNavSectionId,
    playlistId: string
): readonly string[] {
    return ['/tv', 'xtreams', playlistId, id === 'home' ? 'home' : id];
}
