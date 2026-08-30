import type { Channel } from '@iptvnator/shared/interfaces';

/**
 * `HtmlVideoPlayerComponent` takes a full `Channel`, not a bare URL — it
 * reuses the same shape the M3U/Xtream/Stalker hosts pass it. TV mode has no
 * M3U entry to draw the rest of a `Channel` from (Xtream VOD/episode URLs
 * are direct progressive/HLS/TS files), so this fills the unused fields with
 * neutral defaults. `id`/`url` are the only fields the player actually reads
 * off this shape for a stream switch (`playChannel()` keys off `channel.url`
 * and `getPlaybackMediaExtensionFromUrl(channel.url)`).
 */
export function buildTvWebEngineChannel(streamUrl: string): Channel {
    return {
        id: streamUrl,
        url: streamUrl,
        name: '',
        group: { title: '' },
        tvg: { id: '', name: '', url: '', logo: '', rec: '' },
        http: { referrer: '', 'user-agent': '', origin: '' },
        radio: 'false',
    };
}
