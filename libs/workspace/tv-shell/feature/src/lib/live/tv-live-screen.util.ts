import type { EpgItem } from '@iptvnator/shared/interfaces';
import type {
    TvChannelBarItem,
    TvChannelBarProgramme,
    TvEpgGridProgramme,
    TvEpgGridRow,
} from '@iptvnator/workspace/tv-shell/ui';

/**
 * The subset of live-stream fields these functions need. The full Xtream API
 * shape (`XtreamLiveStream`) satisfies this structurally, but the store's
 * `selectItemsFromSelectedCategory()` returns a much looser selection-item
 * shape shared across live/VOD/series (no `stream_type`/`tv_archive`/`num`/
 * ...), so casting that to `XtreamLiveStream[]` was unsound (rejected by
 * TS2352 — the two types don't sufficiently overlap). `toTvLiveChannel`
 * below validates and narrows a raw selection item down to exactly this
 * shape instead of asserting it away.
 */
export interface TvLiveChannelSource {
    readonly xtream_id?: number;
    readonly stream_id?: number;
    readonly name: string;
    readonly stream_icon?: string;
    readonly epg_channel_id?: string;
}

/**
 * Narrows one loosely-typed store selection item down to
 * `TvLiveChannelSource`, or `null` when it lacks a usable id or name/title
 * (e.g. a malformed catalog row) — the same drop convention
 * `toTvChannelBarItem` already applies one step later.
 *
 * The PWA data source hands back the raw Xtream API shape (`name`,
 * `stream_icon`); the Electron DB-first data source hands back the SQLite
 * `content` row shape (`title`, `poster_url` — there is no `name` or
 * `stream_icon` column, see `libs/shared/database/src/lib/schema.ts`). Both
 * are accepted here, mirroring `toTvPosterGridItem`'s `name ?? title` and
 * `resolveTvCatalogPosterUrl`'s `poster_url`/`stream_icon` handling one
 * screen over.
 */
export function toTvLiveChannel(item: {
    readonly xtream_id?: unknown;
    readonly stream_id?: unknown;
    readonly name?: unknown;
    readonly title?: unknown;
    readonly stream_icon?: unknown;
    readonly poster_url?: unknown;
    readonly epg_channel_id?: unknown;
}): TvLiveChannelSource | null {
    const xtreamId = typeof item.xtream_id === 'number' ? item.xtream_id : undefined;
    const streamId =
        typeof item.stream_id === 'number'
            ? item.stream_id
            : typeof item.stream_id === 'string'
              ? Number(item.stream_id)
              : undefined;
    const name =
        typeof item.name === 'string'
            ? item.name
            : typeof item.title === 'string'
              ? item.title
              : undefined;
    if (name === undefined) return null;
    if (xtreamId === undefined && (streamId === undefined || Number.isNaN(streamId))) {
        return null;
    }
    return {
        xtream_id: xtreamId,
        stream_id: streamId,
        name,
        stream_icon:
            typeof item.stream_icon === 'string'
                ? item.stream_icon
                : typeof item.poster_url === 'string'
                  ? item.poster_url
                  : undefined,
        epg_channel_id:
            typeof item.epg_channel_id === 'string' ? item.epg_channel_id : undefined,
    };
}

/** Maps a raw Xtream live stream to the channel bar's item shape. */
export function toTvChannelBarItem(
    stream: TvLiveChannelSource
): TvChannelBarItem | null {
    const id = Number(stream.xtream_id ?? stream.stream_id);
    if (!Number.isFinite(id) || !stream.name) {
        return null;
    }
    return {
        id,
        name: stream.name,
        logoUrl: stream.stream_icon || undefined,
    };
}

export function buildTvChannelBarItems(
    streams: readonly TvLiveChannelSource[]
): TvChannelBarItem[] {
    return streams
        .map(toTvChannelBarItem)
        .filter((item): item is TvChannelBarItem => item !== null);
}

function getEpgTimestampMs(
    dateValue: string | undefined,
    unixTimestampValue: string | undefined
): number {
    const unixTimestamp = Number.parseInt(String(unixTimestampValue ?? ''), 10);
    if (Number.isFinite(unixTimestamp) && unixTimestamp > 0) {
        return unixTimestamp * 1000;
    }
    return Date.parse(String(dateValue ?? ''));
}

/** Converts a store `EpgItem` into the presentational shape the UI components consume. */
export function toEpgProgrammeSummary(
    item: EpgItem | null
): TvChannelBarProgramme | null {
    if (!item) return null;
    const startMs = getEpgTimestampMs(item.start, item.start_timestamp);
    const stopMs = getEpgTimestampMs(item.stop ?? item.end, item.stop_timestamp);
    if (!Number.isFinite(startMs) || !Number.isFinite(stopMs)) {
        return null;
    }
    return { title: item.title, startMs, stopMs };
}

/**
 * Resolves the channel to zap to when Up/Down is pressed (§7.3), wrapping
 * around both ends of the list. Returns `null` when the currently playing
 * channel is not found in `channels` (e.g. it was tuned from a different
 * category) — the caller leaves playback untouched rather than guessing.
 */
export function resolveTvZapTarget(
    channels: readonly TvLiveChannelSource[],
    currentChannelId: number | null,
    direction: 'up' | 'down'
): TvLiveChannelSource | null {
    if (channels.length === 0) return null;
    const currentIndex = channels.findIndex(
        (channel) => Number(channel.xtream_id ?? channel.stream_id) === currentChannelId
    );
    if (currentIndex === -1) return null;
    const delta = direction === 'up' ? -1 : 1;
    const nextIndex = (currentIndex + delta + channels.length) % channels.length;
    return channels[nextIndex];
}

/**
 * Builds one EPG grid row (§7.3) from a channel's short EPG list. `nowMs` is
 * passed in rather than read internally so the caller controls the current
 * import — keeps this pure and unit-testable without faking `Date.now()`.
 */
export function buildTvEpgGridRow(
    channelId: number,
    channelName: string,
    epgItems: readonly EpgItem[],
    nowMs: number
): TvEpgGridRow {
    const programmes: TvEpgGridProgramme[] = epgItems
        .map((item, index): TvEpgGridProgramme | null => {
            const startMs = getEpgTimestampMs(item.start, item.start_timestamp);
            const stopMs = getEpgTimestampMs(
                item.stop ?? item.end,
                item.stop_timestamp
            );
            if (!Number.isFinite(startMs) || !Number.isFinite(stopMs)) {
                return null;
            }
            return {
                id: item.id || `${channelId}-${index}`,
                title: item.title,
                startMs,
                stopMs,
                isCurrent: nowMs >= startMs && nowMs < stopMs,
            };
        })
        .filter((programme): programme is TvEpgGridProgramme => programme !== null);

    return { channelId, channelName, programmes };
}
