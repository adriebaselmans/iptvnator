import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import {
    TvPlaylistSessionService,
    toTvXtreamPlaylistData,
} from './tv-playlist-session.service';

interface FakeXtreamStore {
    playlistId: ReturnType<typeof signal<string | null>>;
    currentPlaylist: ReturnType<typeof signal<{ id: string } | null>>;
    isContentInitialized: ReturnType<typeof signal<boolean>>;
    resetStore: jest.Mock;
    setCurrentPlaylist: jest.Mock;
    fetchXtreamPlaylist: jest.Mock;
    checkPortalStatus: jest.Mock;
    initializeContent: jest.Mock;
}

const PLAYLIST_META = [
    {
        _id: 'p1',
        title: 'Source One',
        serverUrl: 'http://one.test',
        username: 'user-one',
        password: 'pass-one',
    },
    {
        _id: 'p2',
        title: 'Source Two',
        serverUrl: 'http://two.test',
        username: 'user-two',
        password: 'pass-two',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any[];

function createFakeXtreamStore(): FakeXtreamStore {
    return {
        playlistId: signal<string | null>(null),
        currentPlaylist: signal<{ id: string } | null>(null),
        isContentInitialized: signal(false),
        resetStore: jest.fn(),
        setCurrentPlaylist: jest.fn(),
        fetchXtreamPlaylist: jest.fn().mockResolvedValue(undefined),
        checkPortalStatus: jest.fn().mockResolvedValue('active'),
        initializeContent: jest.fn().mockResolvedValue(undefined),
    };
}

function setup(): {
    service: TvPlaylistSessionService;
    store: FakeXtreamStore;
} {
    const store = createFakeXtreamStore();

    TestBed.configureTestingModule({
        providers: [
            { provide: XtreamStore, useValue: store },
            provideMockStore({
                selectors: [
                    { selector: selectAllPlaylistsMeta, value: PLAYLIST_META },
                ],
            }),
        ],
    });

    return {
        service: TestBed.inject(TvPlaylistSessionService),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store: store as any,
    };
}

describe('toTvXtreamPlaylistData', () => {
    it('converts a well-formed Xtream playlist meta', () => {
        expect(
            toTvXtreamPlaylistData({
                _id: 'p1',
                title: 'My Source',
                serverUrl: 'http://example.test',
                username: 'user',
                password: 'pass',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
        ).toEqual({
            id: 'p1',
            name: 'My Source',
            title: 'My Source',
            updateDate: undefined,
            serverUrl: 'http://example.test',
            username: 'user',
            password: 'pass',
            type: 'xtream',
        });
    });

    it('returns null when required connection fields are missing', () => {
        expect(
            toTvXtreamPlaylistData({
                _id: 'p1',
                serverUrl: 'http://example.test',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
        ).toBeNull();
    });

    it('returns null for a null playlist', () => {
        expect(toTvXtreamPlaylistData(null)).toBeNull();
    });
});

describe('TvPlaylistSessionService', () => {
    it('bootstraps a playlist by resetting, loading and initializing the store', async () => {
        const { service, store } = setup();

        await service.ensureBootstrapped('p1');

        expect(store.resetStore).toHaveBeenCalledWith('p1');
        expect(store.setCurrentPlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'p1' })
        );
        expect(store.fetchXtreamPlaylist).toHaveBeenCalledTimes(1);
        expect(store.checkPortalStatus).toHaveBeenCalledTimes(1);
        expect(store.initializeContent).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when re-entering the same already-bootstrapped playlist', async () => {
        const { service, store } = setup();

        await service.ensureBootstrapped('p1');
        await service.ensureBootstrapped('p1');
        await service.ensureBootstrapped('p1');

        // Simulates home -> movies -> series -> movies: every screen for the
        // same playlist joins the first bootstrap instead of re-running it.
        expect(store.resetStore).toHaveBeenCalledTimes(1);
        expect(store.fetchXtreamPlaylist).toHaveBeenCalledTimes(1);
        expect(store.checkPortalStatus).toHaveBeenCalledTimes(1);
        expect(store.initializeContent).toHaveBeenCalledTimes(1);
    });

    it('fully re-bootstraps when switching to a different playlist', async () => {
        const { service, store } = setup();

        await service.ensureBootstrapped('p1');
        await service.ensureBootstrapped('p2');

        expect(store.resetStore).toHaveBeenNthCalledWith(1, 'p1');
        expect(store.resetStore).toHaveBeenNthCalledWith(2, 'p2');
        expect(store.fetchXtreamPlaylist).toHaveBeenCalledTimes(2);
        expect(store.checkPortalStatus).toHaveBeenCalledTimes(2);
        expect(store.initializeContent).toHaveBeenCalledTimes(2);
    });

    it('joins one in-flight bootstrap for concurrent callers of the same playlist', async () => {
        const { service, store } = setup();
        let resolveFetch!: () => void;
        store.fetchXtreamPlaylist.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveFetch = resolve;
            })
        );

        const first = service.ensureBootstrapped('p1');
        const second = service.ensureBootstrapped('p1');

        expect(first).toBe(second);
        expect(store.resetStore).toHaveBeenCalledTimes(1);

        resolveFetch();
        await Promise.all([first, second]);

        expect(store.checkPortalStatus).toHaveBeenCalledTimes(1);
        expect(store.initializeContent).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed bootstrap as success, so the next caller retries', async () => {
        const { service, store } = setup();
        store.checkPortalStatus.mockRejectedValueOnce(
            new Error('portal unreachable')
        );

        await expect(service.ensureBootstrapped('p1')).rejects.toThrow(
            'portal unreachable'
        );
        expect(store.initializeContent).not.toHaveBeenCalled();

        store.checkPortalStatus.mockResolvedValueOnce('active');
        await service.ensureBootstrapped('p1');

        expect(store.resetStore).toHaveBeenCalledTimes(2);
        expect(store.initializeContent).toHaveBeenCalledTimes(1);
    });

    it('treats the store as already bootstrapped when it independently reflects readiness', async () => {
        // Covers the Retry path: `TvCatalogScreenComponent.onRetry()` calls
        // `store.retryContentInitialization()` directly (§10 connectivity
        // guard reset), bypassing this service. If that retry succeeds while
        // this service's own cached attempt had failed, a later navigation
        // must not discard the recovered state.
        const { service, store } = setup();
        store.checkPortalStatus.mockRejectedValueOnce(
            new Error('portal unreachable')
        );
        await expect(service.ensureBootstrapped('p1')).rejects.toThrow();

        store.playlistId.set('p1');
        store.currentPlaylist.set({ id: 'p1' });
        store.isContentInitialized.set(true);

        await service.ensureBootstrapped('p1');

        // resetStore/fetchXtreamPlaylist ran once, for the failed attempt —
        // the recovery path must not run them again.
        expect(store.resetStore).toHaveBeenCalledTimes(1);
        expect(store.fetchXtreamPlaylist).toHaveBeenCalledTimes(1);
    });

    it('rejects immediately for a playlist id that has no usable Xtream credentials', async () => {
        const { service, store } = setup();

        await expect(service.ensureBootstrapped('unknown-id')).rejects.toThrow(
            'not a usable Xtream source'
        );
        expect(store.resetStore).not.toHaveBeenCalled();
    });
});
