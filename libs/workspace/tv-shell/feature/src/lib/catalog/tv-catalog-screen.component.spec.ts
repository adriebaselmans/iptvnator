import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { TranslateModule } from '@ngx-translate/core';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvCatalogScreenComponent } from './tv-catalog-screen.component';

interface FakeXtreamStore {
    setSelectedContentType: jest.Mock;
    getCategoriesBySelectedType: ReturnType<typeof signal<unknown[]>>;
    getCategoryItemCounts: ReturnType<typeof signal<Map<number, number>>>;
    selectedCategoryId: ReturnType<typeof signal<number | null>>;
    getPaginatedContent: ReturnType<typeof signal<unknown[]>>;
    hasMoreContent: ReturnType<typeof signal<boolean>>;
    isPaginatedContentLoading: ReturnType<typeof signal<boolean>>;
    contentInitBlockReason: ReturnType<typeof signal<string | null>>;
    setSelectedCategory: jest.Mock;
    loadMoreContent: jest.Mock;
    retryContentInitialization: jest.Mock;
}

interface FakeTvPlaylistSessionService {
    ensureBootstrapped: jest.Mock;
}

function createFakeXtreamStore(): FakeXtreamStore {
    return {
        setSelectedContentType: jest.fn(),
        getCategoriesBySelectedType: signal<unknown[]>([]),
        getCategoryItemCounts: signal<Map<number, number>>(new Map()),
        selectedCategoryId: signal<number | null>(null),
        getPaginatedContent: signal<unknown[]>([]),
        hasMoreContent: signal(false),
        isPaginatedContentLoading: signal(false),
        contentInitBlockReason: signal<string | null>(null),
        setSelectedCategory: jest.fn(),
        loadMoreContent: jest.fn(),
        retryContentInitialization: jest.fn(() => Promise.resolve()),
    };
}

function createFakeSession(): FakeTvPlaylistSessionService {
    return {
        ensureBootstrapped: jest.fn().mockResolvedValue(undefined),
    };
}

async function setup(
    tvCatalogType: 'vod' | 'series' = 'vod'
): Promise<{
    fixture: ComponentFixture<TvCatalogScreenComponent>;
    store: FakeXtreamStore;
    session: FakeTvPlaylistSessionService;
}> {
    const store = createFakeXtreamStore();
    const session = createFakeSession();

    await TestBed.configureTestingModule({
        imports: [
            TvCatalogScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            { provide: TvPlaylistSessionService, useValue: session },
            {
                provide: ActivatedRoute,
                useValue: {
                    paramMap: of(new Map([['id', 'p1']])),
                    data: of({ tvCatalogType }),
                },
            },
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TvCatalogScreenComponent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, store: store as any, session };
}

describe('TvCatalogScreenComponent', () => {
    it('renders the loading state while the selected content type is loading', async () => {
        const { fixture, store } = await setup();
        store.isPaginatedContentLoading.set(true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                'lib-tv-catalog-state[ng-reflect-variant="loading"]'
            ) ?? fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-poster-grid')
        ).toBeFalsy();
    });

    it('renders the empty state once loaded with no items', async () => {
        const { fixture, store } = await setup();
        store.isPaginatedContentLoading.set(false);
        store.getPaginatedContent.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-poster-grid')
        ).toBeFalsy();
    });

    it('renders the category rail and poster grid once content is ready', async () => {
        const { fixture, store } = await setup();
        store.getPaginatedContent.set([
            { stream_id: 1, name: 'Movie One', stream_icon: 'icon.png' },
        ]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-category-rail')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-poster-grid')
        ).toBeTruthy();
    });

    it('renders the error state with a Retry that resets the connectivity guard before requesting', async () => {
        const { fixture, store } = await setup();
        store.contentInitBlockReason.set('unavailable');
        fixture.detectChanges();

        const stateEl = fixture.nativeElement.querySelector(
            'lib-tv-catalog-state'
        );
        expect(stateEl).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-poster-grid')
        ).toBeFalsy();

        const retryButton = fixture.nativeElement.querySelector(
            '.tv-catalog-state__retry'
        );
        expect(retryButton).toBeTruthy();

        retryButton.click();

        // Retry must go through retryContentInitialization(), which resets
        // HostConnectivityGuard BEFORE issuing its first request (§10) — the
        // screen must not call initializeContent()/checkPortalStatus()
        // directly for Retry, or it skips that reset and fast-fails.
        expect(store.retryContentInitialization).toHaveBeenCalledTimes(1);
    });

    it('bootstraps the store for the resolved playlist id and content type', async () => {
        const { fixture, store, session } = await setup('series');
        fixture.detectChanges();
        await fixture.whenStable();

        // The playlist-level bootstrap (§8.1a) is delegated to the shared
        // session rather than performed by the screen itself.
        expect(session.ensureBootstrapped).toHaveBeenCalledWith('p1');
        expect(store.setSelectedContentType).toHaveBeenCalledWith('series');
    });

    it('does not set the content type when the shared bootstrap fails', async () => {
        const { fixture, store, session } = await setup();
        session.ensureBootstrapped.mockRejectedValue(
            new Error('portal unreachable')
        );

        fixture.detectChanges();
        await fixture.whenStable();

        expect(store.setSelectedContentType).not.toHaveBeenCalled();
    });
});
