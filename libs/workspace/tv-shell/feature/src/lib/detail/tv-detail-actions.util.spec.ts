import type { XtreamSerieEpisode, XtreamVodDetails } from '@iptvnator/shared/interfaces';
import {
    buildTvEpisodeDownloadPayload,
    buildTvVodDownloadPayload,
    resolveTvDetailActionGating,
    resolveTvMovieItem,
    resolveTvSeriesItem,
    toTvEpisodeRowItem,
} from './tv-detail-actions.util';

function episode(id: string, info?: { movie_image?: string }): XtreamSerieEpisode {
    return {
        id,
        episode_num: Number(id),
        title: `Episode ${id}`,
        container_extension: 'mp4',
        info: info ?? [],
        custom_sid: '',
        added: '',
        season: 1,
        direct_source: '',
    };
}

describe('resolveTvMovieItem', () => {
    it('returns null without a raw item', () => {
        expect(resolveTvMovieItem(null, 5)).toBeNull();
    });

    it('returns null when the resolved id does not match the route id', () => {
        const item = { movie_data: { stream_id: 9 } } as unknown as XtreamVodDetails;
        expect(resolveTvMovieItem(item, 5)).toBeNull();
    });

    it('returns the item when the movie_data stream id matches', () => {
        const item = { movie_data: { stream_id: 5 } } as unknown as XtreamVodDetails;
        expect(resolveTvMovieItem(item, 5)).toBe(item);
    });
});

describe('resolveTvSeriesItem', () => {
    it('returns null without a raw item', () => {
        expect(resolveTvSeriesItem(null, 5)).toBeNull();
    });

    it('returns null when series_id does not match', () => {
        expect(resolveTvSeriesItem({ series_id: 9 } as never, 5)).toBeNull();
    });

    it('returns the item when series_id matches', () => {
        const item = { series_id: 5 } as never;
        expect(resolveTvSeriesItem(item, 5)).toBe(item);
    });
});

describe('toTvEpisodeRowItem', () => {
    it('maps a bare episode with no info', () => {
        const result = toTvEpisodeRowItem(episode('3'), false);
        expect(result).toEqual({
            id: 3,
            episodeNumber: 3,
            title: 'Episode 3',
            stillUrl: undefined,
            watched: false,
        });
    });

    it('carries the still image when info is present', () => {
        const result = toTvEpisodeRowItem(
            episode('4', { movie_image: 'still.png' }),
            true
        );
        expect(result.stillUrl).toBe('still.png');
        expect(result.watched).toBe(true);
    });
});

describe('resolveTvDetailActionGating', () => {
    it('gates everything off without a target', () => {
        expect(
            resolveTvDetailActionGating(null, true, () => true, () => true)
        ).toEqual({
            canPlay: false,
            isResume: false,
            canDownload: false,
            canMarkWatched: false,
            isWatched: false,
        });
    });

    it('gates on the target and store capabilities', () => {
        const result = resolveTvDetailActionGating(
            { xtreamId: 1, contentType: 'vod', hasPlayableSource: true, durationSeconds: 100 },
            true,
            () => true,
            () => false
        );
        expect(result).toEqual({
            canPlay: true,
            isResume: true,
            canDownload: true,
            canMarkWatched: true,
            isWatched: false,
        });
    });

    it('never offers download/resume without a playable source', () => {
        const result = resolveTvDetailActionGating(
            { xtreamId: 1, contentType: 'vod', hasPlayableSource: false },
            true,
            () => true,
            () => false
        );
        expect(result.canPlay).toBe(false);
        expect(result.isResume).toBe(false);
        expect(result.canDownload).toBe(false);
    });

    it('never offers mark-watched without a known duration', () => {
        const result = resolveTvDetailActionGating(
            { xtreamId: 1, contentType: 'vod', hasPlayableSource: true },
            true,
            () => false,
            () => false
        );
        expect(result.canMarkWatched).toBe(false);
    });

    it('never offers download when downloads are unavailable', () => {
        const result = resolveTvDetailActionGating(
            { xtreamId: 1, contentType: 'vod', hasPlayableSource: true },
            false,
            () => false,
            () => false
        );
        expect(result.canDownload).toBe(false);
    });
});

describe('buildTvVodDownloadPayload', () => {
    it('builds the download payload with headers from the playlist', () => {
        const payload = buildTvVodDownloadPayload({
            playlist: {
                playlistId: 'p1',
                playlistName: 'My Source',
                serverUrl: 'http://host',
                userAgent: 'UA',
                referrer: 'http://ref',
                origin: 'http://origin',
            },
            xtreamId: 42,
            title: 'A Movie',
            url: 'http://stream',
            posterUrl: 'poster.png',
        });
        expect(payload).toEqual({
            playlistId: 'p1',
            xtreamId: 42,
            contentType: 'vod',
            title: 'A Movie',
            url: 'http://stream',
            posterUrl: 'poster.png',
            playlistName: 'My Source',
            playlistType: 'xtream',
            serverUrl: 'http://host',
            headers: { userAgent: 'UA', referer: 'http://ref', origin: 'http://origin' },
        });
    });
});

describe('buildTvEpisodeDownloadPayload', () => {
    it('builds the episode download payload', () => {
        const payload = buildTvEpisodeDownloadPayload({
            playlist: { playlistId: 'p1', serverUrl: 'http://host' },
            episode: episode('2'),
            seriesXtreamId: 7,
            url: 'http://stream/ep2',
            posterUrl: 'poster.png',
        });
        expect(payload).toEqual({
            playlistId: 'p1',
            xtreamId: 2,
            contentType: 'episode',
            seriesXtreamId: 7,
            seasonNumber: 1,
            episodeNumber: 2,
            title: 'Episode 2',
            url: 'http://stream/ep2',
            posterUrl: 'poster.png',
            playlistName: undefined,
            playlistType: 'xtream',
            serverUrl: 'http://host',
            headers: { userAgent: undefined, referer: undefined, origin: undefined },
        });
    });
});
