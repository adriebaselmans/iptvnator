import type { XtreamSerieEpisode } from '@iptvnator/shared/interfaces';
import {
    buildMarkWatchedPosition,
    buildTvMovieViewModel,
    buildTvSeriesViewModel,
    parseTvDetailRouteType,
    resolveTvAutoSeason,
    resolveTvQuickStartEpisode,
    toTvDetailContentType,
} from './tv-detail-screen.util';

function episode(id: string): XtreamSerieEpisode {
    return {
        id,
        episode_num: Number(id),
        title: `Episode ${id}`,
        container_extension: 'mp4',
        info: [],
        custom_sid: '',
        added: '',
        season: 1,
        direct_source: '',
    };
}

describe('parseTvDetailRouteType', () => {
    it('accepts movie and series', () => {
        expect(parseTvDetailRouteType('movie')).toBe('movie');
        expect(parseTvDetailRouteType('series')).toBe('series');
    });

    it('rejects anything else', () => {
        expect(parseTvDetailRouteType('live')).toBeNull();
        expect(parseTvDetailRouteType(null)).toBeNull();
        expect(parseTvDetailRouteType(undefined)).toBeNull();
    });
});

describe('toTvDetailContentType', () => {
    it('maps movie -> vod, series -> series', () => {
        expect(toTvDetailContentType('movie')).toBe('vod');
        expect(toTvDetailContentType('series')).toBe('series');
    });
});

describe('buildTvMovieViewModel', () => {
    it('falls back to the catalogue title/poster with no provider info', () => {
        const vm = buildTvMovieViewModel(null, 'Fallback Title', 'poster.png');
        expect(vm.title).toBe('Fallback Title');
        expect(vm.posterUrl).toBe('poster.png');
        expect(vm.plot).toBe('');
        expect(vm.chips).toEqual([]);
    });

    it('builds chips from year/genre/rating/duration', () => {
        const vm = buildTvMovieViewModel(
            {
                name: 'Real Title',
                releasedate: '2021-05-01',
                genre: 'Action',
                rating_imdb: '7.5',
                duration: '01:50:00',
            } as never,
            'Fallback'
        );
        expect(vm.title).toBe('Real Title');
        expect(vm.chips).toEqual([
            { label: '2021' },
            { label: 'Action' },
            { label: '★ 7.5' },
            { label: '01:50:00' },
        ]);
    });
});

describe('buildTvSeriesViewModel', () => {
    it('falls back to the catalogue title/poster with no provider info', () => {
        const vm = buildTvSeriesViewModel(null, 'Fallback Series', 'cover.png');
        expect(vm.title).toBe('Fallback Series');
        expect(vm.posterUrl).toBe('cover.png');
    });

    it('builds chips from year/genre/rating', () => {
        const vm = buildTvSeriesViewModel(
            {
                name: 'A Show',
                releaseDate: '2019-01-01',
                genre: 'Drama',
                rating: '8.2',
            } as never,
            'Fallback'
        );
        expect(vm.chips).toEqual([
            { label: '2019' },
            { label: 'Drama' },
            { label: '★ 8.2' },
        ]);
    });
});

describe('resolveTvAutoSeason', () => {
    const seasons = {
        '1': [episode('1'), episode('2')],
        '2': [episode('3'), episode('4')],
    };

    it('returns undefined for no seasons', () => {
        expect(
            resolveTvAutoSeason({
                seasons: {},
                playingEpisodeId: null,
                isEpisodeInProgress: () => false,
                isEpisodeWatched: () => false,
                episodeUpdatedAt: () => undefined,
            })
        ).toBeUndefined();
    });

    it('prefers the playing episode season over everything else', () => {
        const result = resolveTvAutoSeason({
            seasons,
            playingEpisodeId: 3,
            isEpisodeInProgress: () => false,
            isEpisodeWatched: () => true,
            episodeUpdatedAt: () => undefined,
        });
        expect(result).toBe('2');
    });

    it('falls back to the most recently updated in-progress episode season', () => {
        const result = resolveTvAutoSeason({
            seasons,
            playingEpisodeId: null,
            isEpisodeInProgress: (id) => id === 4,
            isEpisodeWatched: () => false,
            episodeUpdatedAt: (id) => (id === 4 ? '2024-01-01' : undefined),
        });
        expect(result).toBe('2');
    });

    it('falls back to the earliest season with unwatched episodes', () => {
        const result = resolveTvAutoSeason({
            seasons,
            playingEpisodeId: null,
            isEpisodeInProgress: () => false,
            isEpisodeWatched: (id) => id === 1,
            episodeUpdatedAt: () => undefined,
        });
        // season 1 has episode 2 unwatched -> still earliest with unwatched
        expect(result).toBe('1');
    });

    it('falls back to the latest non-empty season once everything is watched', () => {
        const result = resolveTvAutoSeason({
            seasons,
            playingEpisodeId: null,
            isEpisodeInProgress: () => false,
            isEpisodeWatched: () => true,
            episodeUpdatedAt: () => undefined,
        });
        expect(result).toBe('2');
    });
});

describe('resolveTvQuickStartEpisode', () => {
    it('returns null for an empty season', () => {
        expect(resolveTvQuickStartEpisode([], () => false)).toBeNull();
    });

    it('returns the first unwatched episode', () => {
        const episodes = [episode('1'), episode('2'), episode('3')];
        const result = resolveTvQuickStartEpisode(
            episodes,
            (id) => id === 1
        );
        expect(result?.id).toBe('2');
    });

    it('returns the first episode once everything is watched', () => {
        const episodes = [episode('1'), episode('2')];
        const result = resolveTvQuickStartEpisode(episodes, () => true);
        expect(result?.id).toBe('1');
    });
});

describe('buildMarkWatchedPosition', () => {
    it('builds a full-progress position row', () => {
        const position = buildMarkWatchedPosition({
            playlistId: 'p1',
            contentXtreamId: 42,
            contentType: 'vod',
            durationSeconds: 5400,
        });
        expect(position).toEqual({
            playlistId: 'p1',
            contentXtreamId: 42,
            contentType: 'vod',
            positionSeconds: 5400,
            durationSeconds: 5400,
        });
    });

    it('includes seriesXtreamId for episodes when provided', () => {
        const position = buildMarkWatchedPosition({
            playlistId: 'p1',
            contentXtreamId: 7,
            contentType: 'episode',
            durationSeconds: 1200,
            seriesXtreamId: 99,
        });
        expect(position.seriesXtreamId).toBe(99);
    });
});
