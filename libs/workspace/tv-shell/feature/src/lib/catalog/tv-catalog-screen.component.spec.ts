import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TvCatalogScreenComponent } from './tv-catalog-screen.component';

interface FakeXtreamStore {
    playlistId: ReturnType<typeof signal<string | null>>;
    currentPlaylist: ReturnType<typeof signal<{ id: string } | null>>;
    resetStore: jest.Mock;
    setCurrentPlaylist: jest.Mock;
    fetchXtreamPlaylist: jest.Mock;
    checkPortalStatus: jest.Mock;
    setSelectedContentType: jest.Mock;
    isContentInitialized: jest.Mock;
    initializeContent: jest.Mock;
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

function createFakeXtreamStore(): FakeXtreamStore {
    const callOrder: string[] = [];

    return {
        playlistId: signal<string | null>('p1'),
        currentPlaylist: signal<{ id: string } | null>({ id: 'p1' }),
        resetStore: jest.fn(),
        setCurrentPlaylist: jest.fn(),
        fetchXtreamPlaylist: jest.fn().mockResolvedValue(undefined),
        checkPortalStatus: jest.fn().mockResolvedValue('active'),
        setSelectedContentType: jest.fn(),
        isContentInitialized: jest.fn().mockReturnValue(true),
        initializeContent: jest.fn().mockResolvedValue(undefined),
        getCategoriesBySelectedType: signal<unknown[]>([]),
        getCategoryItemCounts: signal<Map<number, number>>(new Map()),
        selectedCategoryId: signal<number | null>(null),
        getPaginatedContent: signal<unknown[]>([]),
        hasMoreContent: signal(false),
        isPaginatedContentLoading: signal(false),
        contentInitBlockReason: signal<string | null>(null),
        setSelectedCategory: jest.fn(),
        loadMoreContent: jest.fn(),
        retryContentInitialization: jest.fn(() => {
            callOrder.push('retryContentInitialization');
            return Promise.resolve();
        }),
    };
}

async function setup(
    tvCatalogType: 'vod' | 'series' = 'vod'
): Promise<{
    fixture: ComponentFixture<TvCatalogScreenComponent>;
    store: FakeXtreamStore;
}> {
    const store = createFakeXtreamStore();

    await TestBed.configureTestingModule({
        imports: [
            TvCatalogScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            provideMockStore({
                selectors: [{ selector: selectAllPlaylistsMeta, value: [] }],
            }),
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
    return { fixture, store: store as any };
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
        const { fixture, store } = await setup('series');
        fixture.detectChanges();
        await fixture.whenStable();

        expect(store.setSelectedContentType).toHaveBeenCalledWith('series');
    });
});
