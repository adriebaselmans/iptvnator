import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    EpgQueueService,
    type EpgQueueEntry,
    type XtreamCredentials,
} from '@iptvnator/portal/xtream/data-access';
import type { EpgItem, XtreamLiveStream } from '@iptvnator/shared/interfaces';

function resolveChannelId(stream: XtreamLiveStream): number {
    return Number(stream.xtream_id ?? stream.stream_id);
}

/**
 * Feeds EPG data for the live screen's channel bar and EPG grid through the
 * shared `EpgQueueService` instead of firing one unthrottled
 * `XtreamStore.loadChannelEpg()` request per channel.
 *
 * That queue exists precisely for this: throttled concurrency (2 in flight),
 * a 200 ms inter-request delay, and in-memory caching, so a channel list
 * does not flood the Xtream provider with simultaneous requests. The
 * original version of this screen ran a `Promise.all` over every channel in
 * the category once the EPG grid opened — for a category with a few hundred
 * channels that is a few hundred concurrent, unthrottled provider requests.
 * The likely failure is not just a slow grid: two consecutive
 * connection-level failures trip `HostConnectivityGuard`, which fast-fails
 * every request to that origin for 30 s, so a burst that overwhelms the
 * provider makes the whole portal — including live playback — look dead.
 * A mocked store in tests answers instantly and never rate-limits, so this
 * class of failure is invisible there; it only surfaces against a real
 * provider under load.
 *
 * Component-scoped (provided by `TvLiveScreenComponent`, not root) so its
 * cache and subscription reset with the screen instance instead of leaking
 * results across playlists or navigations.
 */
@Injectable()
export class TvLiveEpgFeedService {
    private readonly epgQueue = inject(EpgQueueService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly cache = signal<ReadonlyMap<number, EpgItem[]>>(new Map());
    readonly epgByStreamId = this.cache.asReadonly();

    constructor() {
        this.epgQueue.epgResult$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(({ streamId, items }) => {
                const next = new Map(this.cache());
                next.set(streamId, items);
                this.cache.set(next);
            });
    }

    /**
     * Requests EPG for exactly `channels`. The queue treats this set as the
     * current "visible" window and drops anything no longer in it
     * (`visibleIds`), so passing the live screen's current category on every
     * call is what keeps a category switch from leaving stale channels
     * queued behind the ones actually on screen.
     */
    ensureVisible(
        channels: readonly XtreamLiveStream[],
        playlistId: string | null,
        credentials: XtreamCredentials
    ): void {
        if (channels.length === 0) return;
        const entries: EpgQueueEntry[] = channels.map((channel) => ({
            streamId: resolveChannelId(channel),
            epgChannelId: channel.epg_channel_id ?? null,
            playlistId,
        }));
        const visibleIds = new Set(entries.map((entry) => entry.streamId));
        void this.epgQueue.enqueue(entries, visibleIds, credentials);
    }
}
