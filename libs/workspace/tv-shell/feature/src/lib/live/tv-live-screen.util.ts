import type { EpgItem, XtreamLiveStream } from '@iptvnator/shared/interfaces';
import type {
    TvChannelBarItem,
    TvChannelBarProgramme,
    TvEpgGridProgramme,
    TvEpgGridRow,
} from '@iptvnator/workspace/tv-shell/ui';

/** Maps a raw Xtream live stream to the channel bar's item shape. */
export function toTvChannelBarItem(
    stream: XtreamLiveStream
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
    streams: readonly XtreamLiveStream[]
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
    channels: readonly XtreamLiveStream[],
    currentChannelId: number | null,
    direction: 'up' | 'down'
): XtreamLiveStream | null {
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
