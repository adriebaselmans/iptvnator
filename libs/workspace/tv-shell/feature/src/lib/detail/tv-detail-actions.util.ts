import type {
    PlaybackPositionData,
    XtreamSerieDetails,
    XtreamSerieEpisode,
    XtreamVodDetails,
} from '@iptvnator/shared/interfaces';
import type { TvEpisodeRowItem } from '@iptvnator/workspace/tv-shell/ui';

/** Resolves the loaded movie item for the route, guarding against a stale/reused selection. */
export function resolveTvMovieItem(
    raw: XtreamVodDetails | null,
    itemId: number
): XtreamVodDetails | null {
    if (!raw) return null;
    const id =
        raw.movie_data?.stream_id ??
        (raw as { stream_id?: number | string }).stream_id;
    return Number(id) === itemId ? raw : null;
}

/** Resolves the loaded series item for the route, guarding against a stale/reused selection. */
export function resolveTvSeriesItem(
    raw: (XtreamSerieDetails & { series_id?: number | string }) | null,
    itemId: number
): XtreamSerieDetails | null {
    if (!raw) return null;
    return Number(raw.series_id) === itemId ? raw : null;
}

/** Maps a provider episode to the episode row's presentational item shape. */
export function toTvEpisodeRowItem(
    episode: XtreamSerieEpisode,
    watched: boolean
): TvEpisodeRowItem {
    const info = Array.isArray(episode.info) ? null : episode.info;
    return {
        id: Number(episode.id),
        episodeNumber: episode.episode_num,
        title: episode.title,
        stillUrl: info?.movie_image,
        watched,
    };
}

/** The single item the top action row's Play/Resume/Download/Mark-watched act on. */
export interface TvDetailPlaybackTarget {
    readonly xtreamId: number;
    readonly contentType: 'vod' | 'episode';
    readonly hasPlayableSource: boolean;
    readonly durationSeconds?: number;
}

export interface TvDetailActionGating {
    readonly canPlay: boolean;
    readonly isResume: boolean;
    readonly canDownload: boolean;
    readonly canMarkWatched: boolean;
    readonly isWatched: boolean;
}

/** Gates the action row (§7.5, §6.4) on what the store can support for the resolved target. */
export function resolveTvDetailActionGating(
    target: TvDetailPlaybackTarget | null,
    downloadsAvailable: boolean,
    isInProgress: (id: number, type: 'vod' | 'episode') => boolean,
    isWatchedFn: (id: number, type: 'vod' | 'episode') => boolean
): TvDetailActionGating {
    if (!target) {
        return {
            canPlay: false,
            isResume: false,
            canDownload: false,
            canMarkWatched: false,
            isWatched: false,
        };
    }
    return {
        canPlay: target.hasPlayableSource,
        isResume:
            target.hasPlayableSource &&
            isInProgress(target.xtreamId, target.contentType),
        canDownload: downloadsAvailable && target.hasPlayableSource,
        canMarkWatched: Boolean(target.durationSeconds),
        isWatched: isWatchedFn(target.xtreamId, target.contentType),
    };
}

/**
 * Identity of whatever is currently playing (§9, Phase 4 resume wiring). Set
 * from Play/Resume and individual episode-row activation — deliberately
 * separate from `TvDetailPlaybackTarget` (the top action row's quick-start
 * suggestion), since a user can pick a specific episode row that differs from
 * quick-start's resolved episode.
 */
export interface TvNowPlaying {
    readonly xtreamId: number;
    readonly contentType: 'vod' | 'episode';
    readonly seriesXtreamId?: number;
}

/**
 * The store's playback-position map key convention
 * (`with-playback-positions.feature.ts`'s `getPositionKey`), applied here so
 * resume lookups and saves cannot drift from it.
 */
function playbackPositionKey(nowPlaying: TvNowPlaying): string {
    return `${nowPlaying.contentType}_${nowPlaying.xtreamId}`;
}

/** Seconds to seed the TV player at, from the store's loaded position map. */
export function resolveTvResumeSeconds(
    positions: ReadonlyMap<string, PlaybackPositionData>,
    nowPlaying: TvNowPlaying | null
): number {
    if (!nowPlaying) return 0;
    return positions.get(playbackPositionKey(nowPlaying))?.positionSeconds ?? 0;
}

/** Builds the row `XtreamStore.savePosition()` persists on playback progress. */
export function buildTvPlaybackPositionPayload(params: {
    readonly playlistId: string;
    readonly nowPlaying: TvNowPlaying;
    readonly positionSeconds: number;
    readonly durationSeconds: number | null;
}): PlaybackPositionData {
    return {
        playlistId: params.playlistId,
        contentXtreamId: params.nowPlaying.xtreamId,
        contentType: params.nowPlaying.contentType,
        positionSeconds: params.positionSeconds,
        ...(params.durationSeconds !== null
            ? { durationSeconds: params.durationSeconds }
            : {}),
        ...(params.nowPlaying.seriesXtreamId !== undefined
            ? { seriesXtreamId: params.nowPlaying.seriesXtreamId }
            : {}),
    };
}

interface TvDownloadHeaders {
    readonly userAgent?: string;
    readonly referer?: string;
    readonly origin?: string;
}

export interface TvDownloadPlaylistContext {
    readonly playlistId: string;
    readonly playlistName?: string;
    readonly serverUrl: string;
    readonly userAgent?: string;
    readonly referrer?: string;
    readonly origin?: string;
}

function toDownloadHeaders(playlist: TvDownloadPlaylistContext): TvDownloadHeaders {
    return {
        userAgent: playlist.userAgent,
        referer: playlist.referrer,
        origin: playlist.origin,
    };
}

/** Builds the (`downloadFolder`-less) payload for `DownloadsService.startDownload()` — movie branch. */
export function buildTvVodDownloadPayload(params: {
    readonly playlist: TvDownloadPlaylistContext;
    readonly xtreamId: number;
    readonly title: string;
    readonly url: string;
    readonly posterUrl?: string;
}) {
    return {
        playlistId: params.playlist.playlistId,
        xtreamId: params.xtreamId,
        contentType: 'vod' as const,
        title: params.title,
        url: params.url,
        posterUrl: params.posterUrl,
        playlistName: params.playlist.playlistName,
        playlistType: 'xtream' as const,
        serverUrl: params.playlist.serverUrl,
        headers: toDownloadHeaders(params.playlist),
    };
}

/** Builds the (`downloadFolder`-less) payload for `DownloadsService.startDownload()` — episode branch. */
export function buildTvEpisodeDownloadPayload(params: {
    readonly playlist: TvDownloadPlaylistContext;
    readonly episode: XtreamSerieEpisode;
    readonly seriesXtreamId: number;
    readonly url: string;
    readonly posterUrl?: string;
}) {
    return {
        playlistId: params.playlist.playlistId,
        xtreamId: Number(params.episode.id),
        contentType: 'episode' as const,
        seriesXtreamId: params.seriesXtreamId,
        seasonNumber: params.episode.season,
        episodeNumber: params.episode.episode_num,
        title: params.episode.title,
        url: params.url,
        posterUrl: params.posterUrl,
        playlistName: params.playlist.playlistName,
        playlistType: 'xtream' as const,
        serverUrl: params.playlist.serverUrl,
        headers: toDownloadHeaders(params.playlist),
    };
}
