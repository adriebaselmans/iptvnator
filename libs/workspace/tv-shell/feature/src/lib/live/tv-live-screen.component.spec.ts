import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import type { EpgItem } from '@iptvnator/shared/interfaces';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvLiveEpgFeedService } from './tv-live-epg-feed.service';
import { TvLiveScreenComponent } from './tv-live-screen.component';

interface FakeChannel {
    xtream_id: number;
    stream_id: number;
    name: string;
    stream_icon: string;
    category_id: string;
    epg_channel_id?: string;
}

function channel(id: number, name: string): FakeChannel {
    return {
        xtream_id: id,
        stream_id: id,
        name,
        stream_icon: '',
        category_id: '1',
    };
}

interface FakeXtreamStore {
    setSelectedContentType: jest.Mock;
    selectItemsFromSelectedCategory: ReturnType<typeof signal<FakeChannel[]>>;
    getCategoriesBySelectedType: ReturnType<typeof signal<unknown[]>>;
    getCategoryItemCounts: ReturnType<typeof signal<Map<number, number>>>;
    selectedCategoryId: ReturnType<typeof signal<number | null>>;
    setSelectedCategory: jest.Mock;
    isPaginatedContentLoading: ReturnType<typeof signal<boolean>>;
    contentInitBlockReason: ReturnType<typeof signal<string | null>>;
    streamUrl: ReturnType<typeof signal<string | null>>;
    constructStreamUrl: jest.Mock;
    currentPlaylist: ReturnType<typeof signal<unknown>>;
    retryContentInitialization: jest.Mock;
}

function createFakeStore(): FakeXtreamStore {
    return {
        setSelectedContentType: jest.fn(),
        selectItemsFromSelectedCategory: signal<FakeChannel[]>([]),
        getCategoriesBySelectedType: signal<unknown[]>([]),
        getCategoryItemCounts: signal<Map<number, number>>(new Map()),
        selectedCategoryId: signal<number | null>(null),
        setSelectedCategory: jest.fn(),
        isPaginatedContentLoading: signal(false),
        contentInitBlockReason: signal<string | null>(null),
        streamUrl: signal<string | null>(null),
        constructStreamUrl: jest.fn(() => 'http://stream'),
        currentPlaylist: signal<unknown>({
            id: 'p1',
            serverUrl: 'http://host',
            username: 'u',
            password: 'p',
        }),
        retryContentInitialization: jest.fn(() => Promise.resolve()),
    };
}

interface FakeEpgFeed {
    epgByStreamId: ReturnType<typeof signal<ReadonlyMap<number, EpgItem[]>>>;
    ensureVisible: jest.Mock;
}

function createFakeEpgFeed(): FakeEpgFeed {
    return {
        epgByStreamId: signal<ReadonlyMap<number, EpgItem[]>>(new Map()),
        ensureVisible: jest.fn(),
    };
}

async function setup(): Promise<{
    fixture: ComponentFixture<TvLiveScreenComponent>;
    store: FakeXtreamStore;
    session: { ensureBootstrapped: jest.Mock };
    focusService: TvFocusService;
    epgFeed: FakeEpgFeed;
}> {
    const store = createFakeStore();
    const session = { ensureBootstrapped: jest.fn().mockResolvedValue(undefined) };
    const epgFeed = createFakeEpgFeed();

    await TestBed.configureTestingModule({
        imports: [
            TvLiveScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            { provide: TvPlaylistSessionService, useValue: session },
            {
                provide: ActivatedRoute,
                useValue: { paramMap: of(new Map([['id', 'p1']])) },
            },
        ],
    });
    // `TvLiveEpgFeedService` is a COMPONENT-level provider (`providers:
    // [TvLiveEpgFeedService]` on `TvLiveScreenComponent`), scoped there
    // deliberately so its cache/subscription reset per screen instance
    // rather than leaking across playlists. A module-level TestBed provider
    // of the same token would be shadowed by that closer injector, so the
    // fake must be installed via `overrideComponent` instead — this also
    // keeps the spec testing the screen's own behaviour (tuning, zapping,
    // overlay open/close, auto-hide, loading/empty/error states) rather
    // than the real `EpgQueueService` → `XtreamApiService` → `DataService`
    // injector chain, which this TestBed does not provide.
    TestBed.overrideComponent(TvLiveScreenComponent, {
        set: {
            providers: [{ provide: TvLiveEpgFeedService, useValue: epgFeed }],
        },
    });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(TvLiveScreenComponent);
    const focusService = TestBed.inject(TvFocusService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, store: store as any, session, focusService, epgFeed };
}

describe('TvLiveScreenComponent', () => {
    it('renders the loading state while content is loading', async () => {
        const { fixture, store } = await setup();
        store.isPaginatedContentLoading.set(true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-playback-overlay')
        ).toBeFalsy();
    });

    it('renders the empty state once loaded with no channels', async () => {
        const { fixture, store } = await setup();
        store.selectItemsFromSelectedCategory.set([]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
    });

    it('renders the error state with a Retry that resets the connectivity guard before requesting', async () => {
        const { fixture, store } = await setup();
        store.contentInitBlockReason.set('unavailable');
        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            '.tv-catalog-state__retry'
        );
        expect(retryButton).toBeTruthy();
        retryButton.click();

        // §10: Retry must go through retryContentInitialization(), which
        // resets HostConnectivityGuard before its first request.
        expect(store.retryContentInitialization).toHaveBeenCalledTimes(1);
    });

    it('bootstraps the shared session and sets the live content type', async () => {
        const { fixture, store, session } = await setup();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(session.ensureBootstrapped).toHaveBeenCalledWith('p1');
        expect(store.setSelectedContentType).toHaveBeenCalledWith('live');
    });

    it('auto-tunes the first channel once channels are available', async () => {
        const { fixture, store } = await setup();
        store.selectItemsFromSelectedCategory.set([
            channel(1, 'A'),
            channel(2, 'B'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(store.constructStreamUrl).toHaveBeenCalledWith(
            expect.objectContaining({ xtream_id: 1 })
        );
        expect(fixture.componentInstance['playingChannelId']()).toBe(1);
    });

    it('zaps to the next/previous channel on Up/Down', async () => {
        const { fixture, store } = await setup();
        store.selectItemsFromSelectedCategory.set([
            channel(1, 'A'),
            channel(2, 'B'),
            channel(3, 'C'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onChannelChange']('down');
        expect(store.constructStreamUrl).toHaveBeenLastCalledWith(
            expect.objectContaining({ xtream_id: 2 })
        );

        fixture.componentInstance['onChannelChange']('up');
        expect(store.constructStreamUrl).toHaveBeenLastCalledWith(
            expect.objectContaining({ xtream_id: 1 })
        );
    });

    it('OK opens the channel bar with focus on the playing channel; Back closes it', async () => {
        const { fixture, store, focusService } = await setup();
        store.selectItemsFromSelectedCategory.set([
            channel(1, 'A'),
            channel(2, 'B'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onOpenChannelBar']();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.componentInstance['overlayOpen']()).toBe(true);
        expect(focusService.activeGroupId()).toBe('tv-live-channel-bar');
        expect(
            fixture.nativeElement.querySelector('lib-tv-channel-bar')
        ).toBeTruthy();

        fixture.componentInstance['onOverlayBack']();
        fixture.detectChanges();

        expect(fixture.componentInstance['overlayOpen']()).toBe(false);
    });

    it('tunes and closes the overlay when a channel bar row is activated', async () => {
        const { fixture, store } = await setup();
        store.selectItemsFromSelectedCategory.set([
            channel(1, 'A'),
            channel(2, 'B'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onOpenChannelBar']();
        fixture.componentInstance['onChannelBarActivated']({ id: 2, name: 'B' });
        fixture.detectChanges();

        expect(store.constructStreamUrl).toHaveBeenLastCalledWith(
            expect.objectContaining({ xtream_id: 2 })
        );
        expect(fixture.componentInstance['overlayOpen']()).toBe(false);
    });

    it('selecting a category filters channels and returns focus to the channel bar', async () => {
        const { fixture, store, focusService } = await setup();
        store.selectItemsFromSelectedCategory.set([channel(1, 'A')]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onOpenChannelBar']();
        fixture.detectChanges();
        fixture.componentInstance['onCategorySelected'](7);
        fixture.detectChanges();

        expect(store.setSelectedCategory).toHaveBeenCalledWith(7);
        expect(focusService.activeGroupId()).toBe('tv-live-channel-bar');
    });

    it('requests EPG for the whole category when the channel bar auto-opens, not per channel', async () => {
        const { fixture, store, epgFeed } = await setup();
        store.selectItemsFromSelectedCategory.set([
            channel(1, 'A'),
            channel(2, 'B'),
            channel(3, 'C'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(epgFeed.ensureVisible).toHaveBeenCalledTimes(1);
        expect(epgFeed.ensureVisible).toHaveBeenCalledWith(
            [
                expect.objectContaining({ xtream_id: 1 }),
                expect.objectContaining({ xtream_id: 2 }),
                expect.objectContaining({ xtream_id: 3 }),
            ],
            'p1',
            expect.objectContaining({
                serverUrl: 'http://host',
                username: 'u',
                password: 'p',
            })
        );
    });

    it('does not re-request EPG after closing and reopening the overlay', async () => {
        const { fixture, store, epgFeed } = await setup();
        store.selectItemsFromSelectedCategory.set([channel(1, 'A')]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const callsAfterAutoOpen = epgFeed.ensureVisible.mock.calls.length;
        fixture.componentInstance['onOverlayBack']();
        fixture.detectChanges();
        fixture.componentInstance['onOpenChannelBar']();
        fixture.detectChanges();

        expect(epgFeed.ensureVisible).toHaveBeenCalledTimes(callsAfterAutoOpen + 1);
    });

    it('auto-hides the overlay after 5s of no focus movement, and stays open within that window', async () => {
        jest.useFakeTimers();
        try {
            const { fixture } = await setup();
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            fixture.componentInstance['onOpenChannelBar']();
            fixture.detectChanges();
            expect(fixture.componentInstance['overlayOpen']()).toBe(true);

            jest.advanceTimersByTime(4000);
            expect(fixture.componentInstance['overlayOpen']()).toBe(true);

            jest.advanceTimersByTime(1500);
            expect(fixture.componentInstance['overlayOpen']()).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
