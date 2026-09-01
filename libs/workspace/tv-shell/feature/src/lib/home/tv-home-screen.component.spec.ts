import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { DataService, SettingsStore } from '@iptvnator/services';
import {
    DEFAULT_DASHBOARD_RAILS_SETTINGS,
    type DashboardRailsSettings,
    type EpgItem,
    type PortalActivityItem,
} from '@iptvnator/shared/interfaces';
import {
    DashboardDataService,
    DashboardRecommendationsService,
    DashboardTrendingService,
} from '@iptvnator/workspace/dashboard/data-access';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvLiveEpgFeedService } from '../live/tv-live-epg-feed.service';
import { TvHomeScreenComponent } from './tv-home-screen.component';

const PLAYLIST_ID = 'p1';

function recentItem(
    overrides: Partial<PortalActivityItem & { viewed_at: string }> = {}
): PortalActivityItem & { viewed_at: string } {
    return {
        id: 1,
        title: 'Dune',
        type: 'movie',
        playlist_id: PLAYLIST_ID,
        category_id: 1,
        xtream_id: 42,
        viewed_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

type FakeActivityItem = ReturnType<typeof recentItem>;

interface FakeDashboardData {
    playlists: ReturnType<typeof signal<unknown[]>>;
    dashboardReady: ReturnType<typeof signal<boolean>>;
    globalRecentVodItems: ReturnType<typeof signal<FakeActivityItem[]>>;
    globalFavoriteItems: ReturnType<typeof signal<FakeActivityItem[]>>;
    globalFavoriteLiveItems: ReturnType<typeof signal<FakeActivityItem[]>>;
    xtreamRecentlyAddedItems: ReturnType<typeof signal<FakeActivityItem[]>>;
    xtreamPlaylistCount: ReturnType<typeof signal<number>>;
    globalFavoritesLoaded: ReturnType<typeof signal<boolean>>;
    reloadGlobalRecentItems: jest.Mock;
    reloadGlobalFavorites: jest.Mock;
    reloadXtreamRecentlyAddedItems: jest.Mock;
}

function createFakeData(): FakeDashboardData {
    return {
        playlists: signal([]),
        dashboardReady: signal(true),
        globalRecentVodItems: signal([]),
        globalFavoriteItems: signal([]),
        globalFavoriteLiveItems: signal([]),
        xtreamRecentlyAddedItems: signal([]),
        xtreamPlaylistCount: signal(0),
        globalFavoritesLoaded: signal(true),
        reloadGlobalRecentItems: jest.fn().mockResolvedValue(undefined),
        reloadGlobalFavorites: jest.fn().mockResolvedValue(undefined),
        reloadXtreamRecentlyAddedItems: jest.fn().mockResolvedValue(undefined),
    };
}

interface FakeMatchedEntry {
    readonly title: string;
    readonly posterUrl: string | null;
    readonly match: { playlistId: string; type: 'movie' | 'series'; xtreamId: number };
}

function createFakeTrending() {
    return {
        items: signal<FakeMatchedEntry[]>([]),
        loading: signal(false),
        isAvailable: false,
        load: jest.fn().mockResolvedValue(undefined),
    };
}

function createFakeRecommendations() {
    return {
        items: signal<FakeMatchedEntry[]>([]),
        seedTitles: signal<readonly string[]>([]),
        loading: signal(false),
        isAvailable: false,
        load: jest.fn().mockResolvedValue(undefined),
    };
}

function createFakeEpgFeed() {
    return {
        epgByStreamId: signal<ReadonlyMap<number, EpgItem[]>>(new Map()),
        ensureVisible: jest.fn(),
        ensureVisibleEntries: jest.fn(),
    };
}

async function setup(options?: {
    bootstrapFails?: boolean;
    dashboardRails?: Partial<DashboardRailsSettings>;
}): Promise<{
    fixture: ComponentFixture<TvHomeScreenComponent>;
    data: FakeDashboardData;
    trending: ReturnType<typeof createFakeTrending>;
    recommendations: ReturnType<typeof createFakeRecommendations>;
    epgFeed: ReturnType<typeof createFakeEpgFeed>;
    session: { ensureBootstrapped: jest.Mock };
    dataService: { sendIpcEvent: jest.Mock };
    router: Router;
}> {
    const data = createFakeData();
    const trending = createFakeTrending();
    const recommendations = createFakeRecommendations();
    const epgFeed = createFakeEpgFeed();
    const session = {
        ensureBootstrapped: options?.bootstrapFails
            ? jest.fn().mockRejectedValue(new Error('fail'))
            : jest.fn().mockResolvedValue(undefined),
    };
    const dataService = { sendIpcEvent: jest.fn().mockResolvedValue({ success: true }) };
    const store = {
        currentPlaylist: signal({
            id: PLAYLIST_ID,
            serverUrl: 'http://host',
            username: 'u',
            password: 'p',
        }),
    };
    const settingsStore = {
        dashboardRails: signal<DashboardRailsSettings>({
            ...DEFAULT_DASHBOARD_RAILS_SETTINGS,
            ...options?.dashboardRails,
        }),
    };

    await TestBed.configureTestingModule({
        imports: [
            TvHomeScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            { provide: TvPlaylistSessionService, useValue: session },
            { provide: DashboardDataService, useValue: data },
            { provide: DashboardTrendingService, useValue: trending },
            { provide: DashboardRecommendationsService, useValue: recommendations },
            { provide: DataService, useValue: dataService },
            { provide: SettingsStore, useValue: settingsStore },
            {
                provide: ActivatedRoute,
                useValue: { paramMap: of(new Map([['id', PLAYLIST_ID]])) },
            },
        ],
    });
    // TvLiveEpgFeedService is component-scoped (§14 pattern, mirrored from
    // the live screen's own spec) — shadow it via overrideComponent.
    TestBed.overrideComponent(TvHomeScreenComponent, {
        set: { providers: [{ provide: TvLiveEpgFeedService, useValue: epgFeed }] },
    });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(TvHomeScreenComponent);
    const router = TestBed.inject(Router);
    return { fixture, data, trending, recommendations, epgFeed, session, dataService, router };
}

describe('TvHomeScreenComponent', () => {
    it('renders the loading state while the dashboard has not settled', async () => {
        const { fixture, data } = await setup();
        data.dashboardReady.set(false);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-home-hero')
        ).toBeFalsy();
    });

    it('renders the empty state once ready with nothing to show', async () => {
        const { fixture } = await setup();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelectorAll('lib-tv-home-rail').length
        ).toBe(0);
    });

    it('renders the error state when the shared session bootstrap fails, with a Retry that resets the connectivity guard first', async () => {
        const { fixture, dataService, session } = await setup({
            bootstrapFails: true,
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            '.tv-catalog-state__retry'
        );
        expect(retryButton).toBeTruthy();

        session.ensureBootstrapped.mockResolvedValueOnce(undefined);
        retryButton.click();
        await fixture.whenStable();

        expect(dataService.sendIpcEvent).toHaveBeenCalledWith(
            expect.any(String),
            { url: 'http://host' }
        );
        expect(session.ensureBootstrapped).toHaveBeenCalledTimes(2);
    });

    it('renders only the rails that have items — an empty rail does not render at all', async () => {
        const { fixture, data } = await setup();
        data.globalFavoriteItems.set([
            { ...recentItem({ id: 5, added_at: '2026-01-01T00:00:00.000Z' }) },
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const rails: HTMLElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('lib-tv-home-rail')
        );
        expect(rails.length).toBe(1);
        expect(rails[0].textContent).toContain('Dune');
    });

    it('the hero resume CTA navigates to the right item', async () => {
        const { fixture, data, router } = await setup();
        data.globalRecentVodItems.set([recentItem()]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
        const resumeButton = fixture.nativeElement.querySelector(
            '.tv-home-hero__resume'
        );
        expect(resumeButton).toBeTruthy();
        resumeButton.click();

        expect(navigateSpy).toHaveBeenCalledWith([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'movie',
            '42',
        ]);
    });

    it('does not render the trending/recommendation rails when disabled in settings, even with matching data', async () => {
        const { fixture, trending, recommendations } = await setup({
            dashboardRails: { tmdbTrending: false, tmdbRecommendations: false },
        });
        Object.defineProperty(trending, 'isAvailable', { value: true });
        Object.defineProperty(recommendations, 'isAvailable', { value: true });
        trending.items.set([
            {
                title: 'Trend',
                posterUrl: null,
                match: { playlistId: PLAYLIST_ID, type: 'movie', xtreamId: 1 },
            },
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(trending.load).not.toHaveBeenCalled();
        expect(recommendations.load).not.toHaveBeenCalled();
        const rails: HTMLElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('lib-tv-home-rail')
        );
        expect(rails.length).toBe(0);
    });

    it('requests EPG for the whole Live now rail once, never one request per channel', async () => {
        const { fixture, data, epgFeed } = await setup();
        data.globalFavoriteLiveItems.set([
            recentItem({ id: 10, type: 'live', xtream_id: 100 }),
            recentItem({ id: 11, type: 'live', xtream_id: 101 }),
            recentItem({ id: 12, type: 'live', xtream_id: 102 }),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(epgFeed.ensureVisibleEntries).toHaveBeenCalledTimes(1);
        const [entries] = epgFeed.ensureVisibleEntries.mock.calls[0];
        expect(entries).toHaveLength(3);
    });

    it('bootstraps the shared session for this playlist', async () => {
        const { fixture, session } = await setup();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(session.ensureBootstrapped).toHaveBeenCalledWith(PLAYLIST_ID);
    });
});
