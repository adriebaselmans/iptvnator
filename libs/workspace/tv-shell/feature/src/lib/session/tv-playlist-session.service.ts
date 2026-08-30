import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import {
    XtreamPlaylistData,
    XtreamStore,
} from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';

/** Mirrors `XtreamWorkspaceRouteSession`'s playlist-meta conversion, scoped to the TV shell's own minimal bootstrap. */
export function toTvXtreamPlaylistData(
    playlist: PlaylistMeta | null | undefined
): XtreamPlaylistData | null {
    if (
        !playlist?._id ||
        !playlist.serverUrl ||
        !playlist.username ||
        !playlist.password
    ) {
        return null;
    }

    return {
        id: playlist._id,
        name: playlist.title || playlist.filename || playlist._id,
        title: playlist.title,
        updateDate: playlist.updateDate,
        serverUrl: playlist.serverUrl,
        username: playlist.username,
        password: playlist.password,
        type: 'xtream',
        ...(playlist.userAgent ? { userAgent: playlist.userAgent } : {}),
        ...(playlist.referrer ? { referrer: playlist.referrer } : {}),
        ...(playlist.origin ? { origin: playlist.origin } : {}),
    };
}

interface TvPlaylistBootstrap {
    readonly playlistId: string;
    readonly promise: Promise<void>;
}

/**
 * Route-agnostic `XtreamStore` bootstrap shared by every TV screen (§8.1a).
 *
 * Phase 3a had `TvCatalogScreenComponent` reset/fetch/check-status/initialize
 * the store itself. That breaks the moment a second screen exists: home →
 * movies → series would re-run the whole sequence on every hop and race
 * itself. This service resolves the sequence once per playlist and every
 * screen that navigates to the same playlist joins the same result instead
 * of repeating it.
 *
 * The desktop's `XtreamWorkspaceRouteSession` is not reused here: it drives
 * itself off the `/workspace/xtreams/:id/...` URL shape (category ids,
 * section names, cached-content scopes) and is a portal *feature*, which
 * §5.5 puts out of bounds for the shell. This service only owns the
 * playlist-level bootstrap; per-screen concerns such as
 * `setSelectedContentType()` stay on the screen, because `initializeContent()`
 * itself loads every content type in one pass — there is nothing
 * content-type-scoped left to cache here.
 */
@Injectable({ providedIn: 'root' })
export class TvPlaylistSessionService {
    private readonly ngrxStore = inject(Store);
    private readonly store = inject(XtreamStore);

    private readonly playlists = this.ngrxStore.selectSignal(
        selectAllPlaylistsMeta
    );

    /**
     * The playlist this service most recently bootstrapped (or is currently
     * bootstrapping), and the promise tracking that attempt. `null` means
     * "nothing known to be bootstrapped" — either nothing has run yet, or
     * the last attempt failed and must be retried by the next caller.
     */
    private current: TvPlaylistBootstrap | null = null;

    /**
     * Resolves once `XtreamStore` is bootstrapped for `playlistId`.
     *
     * - Same playlist, already bootstrapped: resolves immediately, no store
     *   calls (no-op re-entry).
     * - Same playlist, bootstrap in flight: returns the same promise every
     *   concurrent caller is already awaiting (single join, not a race).
     * - Different playlist: starts a fresh reset → fetch → portal-status →
     *   initializeContent sequence.
     * - A failed attempt is never cached as success: the promise rejects,
     *   internal state is cleared, and the next caller retries from scratch.
     */
    ensureBootstrapped(playlistId: string): Promise<void> {
        if (!playlistId) {
            return Promise.reject(
                new Error(
                    'TvPlaylistSessionService.ensureBootstrapped: playlistId is required'
                )
            );
        }

        if (this.current?.playlistId === playlistId) {
            return this.current.promise;
        }

        // Defensive fallback, not a fast path: if the store itself already
        // reflects this playlist as fully initialized — e.g. the catalogue
        // screen's error-state Retry went straight through
        // `store.retryContentInitialization()` (§10, the connectivity-guard
        // reset it performs must not be duplicated here) and succeeded while
        // this service's own bootstrap had failed — treat it as bootstrapped
        // rather than repeating reset/fetch/checkPortalStatus and discarding
        // that recovered state.
        if (
            this.store.playlistId() === playlistId &&
            this.store.currentPlaylist()?.id === playlistId &&
            this.store.isContentInitialized()
        ) {
            const readyBootstrap: TvPlaylistBootstrap = {
                playlistId,
                promise: Promise.resolve(),
            };
            this.current = readyBootstrap;
            return readyBootstrap.promise;
        }

        const bootstrap: TvPlaylistBootstrap = {
            playlistId,
            promise: this.runBootstrap(playlistId).catch((error: unknown) => {
                if (this.current === bootstrap) {
                    this.current = null;
                }
                throw error;
            }),
        };
        this.current = bootstrap;
        return bootstrap.promise;
    }

    private async runBootstrap(playlistId: string): Promise<void> {
        const meta =
            this.playlists().find(
                (playlist: PlaylistMeta) => playlist._id === playlistId
            ) ?? null;
        const playlistData = toTvXtreamPlaylistData(meta);
        if (!playlistData) {
            throw new Error(
                `TvPlaylistSessionService: playlist "${playlistId}" is not a usable Xtream source`
            );
        }

        this.store.resetStore(playlistId);
        this.store.setCurrentPlaylist(playlistData);
        await this.store.fetchXtreamPlaylist();
        await this.store.checkPortalStatus();
        await this.store.initializeContent();
    }
}
