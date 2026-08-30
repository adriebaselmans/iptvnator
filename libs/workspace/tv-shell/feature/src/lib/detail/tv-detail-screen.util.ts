import type {
    PlaybackPositionData,
    XtreamSerieEpisode,
    XtreamSerieInfo,
    XtreamVodInfo,
} from '@iptvnator/shared/interfaces';

/** The detail route's `:type` segment (§5.2 route table). */
export type TvDetailRouteType = 'movie' | 'series';

export function parseTvDetailRouteType(
    raw: string | null | undefined
): TvDetailRouteType | null {
    return raw === 'movie' || raw === 'series' ? raw : null;
}

/** Maps the route's `:type` to the store's `ContentType`/favorite-type vocabulary. */
export function toTvDetailContentType(
    type: TvDetailRouteType
): 'vod' | 'series' {
    return type === 'movie' ? 'vod' : 'series';
}

export interface TvDetailChip {
    readonly label: string;
}

export interface TvDetailViewModel {
    readonly title: string;
    readonly plot: string;
    readonly posterUrl?: string;
    readonly backdropUrl?: string;
    readonly chips: readonly TvDetailChip[];
}

function releaseYear(date: string | undefined | null): string | null {
    if (!date) {
        return null;
    }
    const year = date.slice(0, 4);
    return /^\d{4}$/.test(year) ? year : null;
}

/** Maps `get_vod_info` (§7.5, TMDB-merged) to the hero view model. */
export function buildTvMovieViewModel(
    info: XtreamVodInfo | null,
    fallbackTitle: string,
    fallbackPoster?: string
): TvDetailViewModel {
    const chips: TvDetailChip[] = [];
    const year = releaseYear(info?.releasedate);
    if (year) {
        chips.push({ label: year });
    }
    if (info?.genre) {
        chips.push({ label: info.genre });
    }
    const rating =
        info?.rating_imdb ||
        (info?.rating !== undefined && info?.rating !== null
            ? String(info.rating)
            : '');
    if (rating) {
        chips.push({ label: `★ ${rating}` });
    }
    if (info?.duration) {
        chips.push({ label: info.duration });
    }

    return {
        title: info?.name || fallbackTitle,
        plot: info?.plot || info?.description || '',
        posterUrl: info?.movie_image || info?.cover_big || fallbackPoster,
        backdropUrl: info?.backdrop_path?.[0],
        chips,
    };
}

/** Maps `get_series_info` (§7.5, TMDB-merged) to the hero view model. */
export function buildTvSeriesViewModel(
    info: XtreamSerieInfo | null,
    fallbackTitle: string,
    fallbackPoster?: string
): TvDetailViewModel {
    const chips: TvDetailChip[] = [];
    const year = releaseYear(info?.releaseDate);
    if (year) {
        chips.push({ label: year });
    }
    if (info?.genre) {
        chips.push({ label: info.genre });
    }
    if (info?.rating) {
        chips.push({ label: `★ ${info.rating}` });
    }

    return {
        title: info?.name || fallbackTitle,
        plot: info?.plot || '',
        posterUrl: info?.cover || fallbackPoster,
        backdropUrl: info?.backdrop_path?.[0],
        chips,
    };
}

type SeasonMap = Readonly<Record<string, readonly XtreamSerieEpisode[]>>;

function sortedSeasonKeys(seasons: SeasonMap): string[] {
    return Object.keys(seasons).sort((a, b) => Number(a) - Number(b));
}

function findSeasonOfEpisode(
    seasons: SeasonMap,
    episodeId: number
): string | null {
    for (const [key, episodes] of Object.entries(seasons)) {
        if (episodes.some((episode) => Number(episode.id) === episodeId)) {
            return key;
        }
    }
    return null;
}

/**
 * Fallback when nothing is playing or in progress: the earliest season with
 * unwatched episodes, or — once everything is watched — the latest
 * non-empty season, where new episodes land. Mirrors
 * `SeasonContainerComponent.resolveDefaultSeason` (§7.5 — "reuse the
 * season-selection semantics the desktop `serial-details` already
 * implements"), minus the Stalker lazy-VOD `hasUnloadedSeasons` branch: the
 * TV shell only ever drives Xtream, whose seasons/episodes arrive fully
 * loaded from `get_series_info` in one response.
 */
function resolveDefaultSeason(
    keys: readonly string[],
    seasons: SeasonMap,
    isEpisodeWatched: (episodeId: number) => boolean
): string {
    const firstUnwatched = keys.find((key) => {
        const episodes = seasons[key] ?? [];
        return (
            episodes.length > 0 &&
            episodes.some((episode) => !isEpisodeWatched(Number(episode.id)))
        );
    });
    if (firstUnwatched) {
        return firstUnwatched;
    }
    const latestWithEpisodes = [...keys]
        .reverse()
        .find((key) => (seasons[key] ?? []).length > 0);
    return latestWithEpisodes ?? keys[0];
}

function findMostRecentInProgressSeason(
    seasons: SeasonMap,
    isEpisodeInProgress: (episodeId: number) => boolean,
    episodeUpdatedAt: (episodeId: number) => string | undefined
): string | null {
    let bestSeason: string | null = null;
    let bestUpdatedAt = '';
    for (const [key, episodes] of Object.entries(seasons)) {
        for (const episode of episodes) {
            const episodeId = Number(episode.id);
            if (!isEpisodeInProgress(episodeId)) {
                continue;
            }
            const updatedAt = episodeUpdatedAt(episodeId) ?? '';
            if (updatedAt >= bestUpdatedAt) {
                bestUpdatedAt = updatedAt;
                bestSeason = key;
            }
        }
    }
    return bestSeason;
}

export interface TvSeasonAutoSelectContext {
    readonly seasons: SeasonMap;
    readonly playingEpisodeId: number | null;
    readonly isEpisodeInProgress: (episodeId: number) => boolean;
    readonly isEpisodeWatched: (episodeId: number) => boolean;
    readonly episodeUpdatedAt: (episodeId: number) => string | undefined;
}

/**
 * Initial/auto season selection (§7.5): playing episode's season → most
 * recently updated in-progress episode's season → earliest season with
 * unwatched episodes → latest non-empty season.
 */
export function resolveTvAutoSeason(
    ctx: TvSeasonAutoSelectContext
): string | undefined {
    const keys = sortedSeasonKeys(ctx.seasons);
    if (keys.length === 0) {
        return undefined;
    }

    const playingSeason =
        ctx.playingEpisodeId !== null
            ? findSeasonOfEpisode(ctx.seasons, ctx.playingEpisodeId)
            : null;
    if (playingSeason) {
        return playingSeason;
    }

    const resumeSeason = findMostRecentInProgressSeason(
        ctx.seasons,
        ctx.isEpisodeInProgress,
        ctx.episodeUpdatedAt
    );
    return resumeSeason ?? resolveDefaultSeason(keys, ctx.seasons, ctx.isEpisodeWatched);
}

/**
 * The episode the top action row's Play/Resume targets for a series: the
 * first not-fully-watched episode of the selected season, or its first
 * episode once everything in it is watched.
 */
export function resolveTvQuickStartEpisode(
    episodes: readonly XtreamSerieEpisode[],
    isEpisodeWatched: (episodeId: number) => boolean
): XtreamSerieEpisode | null {
    if (episodes.length === 0) {
        return null;
    }
    return (
        episodes.find((episode) => !isEpisodeWatched(Number(episode.id))) ??
        episodes[0]
    );
}

/** Builds the full-progress position row a "Mark watched" action saves. */
export function buildMarkWatchedPosition(params: {
    readonly playlistId: string;
    readonly contentXtreamId: number;
    readonly contentType: 'vod' | 'episode';
    readonly durationSeconds: number;
    readonly seriesXtreamId?: number;
}): PlaybackPositionData {
    return {
        playlistId: params.playlistId,
        contentXtreamId: params.contentXtreamId,
        contentType: params.contentType,
        positionSeconds: params.durationSeconds,
        durationSeconds: params.durationSeconds,
        ...(params.seriesXtreamId !== undefined
            ? { seriesXtreamId: params.seriesXtreamId }
            : {}),
    };
}
