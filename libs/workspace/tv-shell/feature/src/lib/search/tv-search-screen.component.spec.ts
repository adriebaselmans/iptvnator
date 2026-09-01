import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { DataService } from '@iptvnator/services';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvSearchScreenComponent } from './tv-search-screen.component';

const PLAYLIST_ID = 'p1';

function searchItem(id: number, title: string, type = 'movie') {
    return { xtream_id: id, title, type, poster_url: '' };
}

interface FakeXtreamStore {
    searchResults: ReturnType<typeof signal<unknown[]>>;
    isSearching: ReturnType<typeof signal<boolean>>;
    searchContent: jest.Mock;
    resetSearchResults: jest.Mock;
    currentPlaylist: ReturnType<typeof signal<unknown>>;
}

function createFakeStore(): FakeXtreamStore {
    return {
        searchResults: signal<unknown[]>([]),
        isSearching: signal(false),
        searchContent: jest.fn().mockResolvedValue([]),
        resetSearchResults: jest.fn(),
        currentPlaylist: signal({
            id: PLAYLIST_ID,
            serverUrl: 'http://host',
            username: 'u',
            password: 'p',
        }),
    };
}

async function setup(options?: { bootstrapFails?: boolean }): Promise<{
    fixture: ComponentFixture<TvSearchScreenComponent>;
    store: FakeXtreamStore;
    session: { ensureBootstrapped: jest.Mock };
    dataService: { sendIpcEvent: jest.Mock };
    focusService: TvFocusService;
    router: Router;
}> {
    const store = createFakeStore();
    const session = {
        ensureBootstrapped: options?.bootstrapFails
            ? jest.fn().mockRejectedValue(new Error('fail'))
            : jest.fn().mockResolvedValue(undefined),
    };
    const dataService = { sendIpcEvent: jest.fn().mockResolvedValue({ success: true }) };

    await TestBed.configureTestingModule({
        imports: [
            TvSearchScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            { provide: TvPlaylistSessionService, useValue: session },
            { provide: DataService, useValue: dataService },
            {
                provide: ActivatedRoute,
                useValue: { paramMap: of(new Map([['id', PLAYLIST_ID]])) },
            },
        ],
    });
    await TestBed.compileComponents();

    const fixture = TestBed.createComponent(TvSearchScreenComponent);
    const focusService = TestBed.inject(TvFocusService);
    const router = TestBed.inject(Router);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, store: store as any, session, dataService, focusService, router };
}

describe('TvSearchScreenComponent', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('always renders the keyboard as a fixed-column grid, even before any query', async () => {
        const { fixture } = await setup();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelectorAll('.tv-keyboard__key').length
        ).toBe(39);
    });

    it('OK on a letter key appends the character and Backspace removes it', async () => {
        const { fixture } = await setup();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onCharEntered']('d');
        fixture.componentInstance['onCharEntered']('u');
        fixture.detectChanges();
        expect(fixture.componentInstance['query']()).toBe('du');

        fixture.componentInstance['onBackspace']();
        fixture.detectChanges();
        expect(fixture.componentInstance['query']()).toBe('d');
    });

    it('Clear empties the query', async () => {
        const { fixture } = await setup();
        fixture.detectChanges();
        fixture.componentInstance['onCharEntered']('a');
        fixture.componentInstance['onCleared']();
        expect(fixture.componentInstance['query']()).toBe('');
    });

    it('debounces the query and searches the store once it reaches the minimum length', async () => {
        jest.useFakeTimers();
        const { fixture, store } = await setup();
        fixture.detectChanges();

        for (const char of ['d', 'u', 'n']) {
            fixture.componentInstance['onCharEntered'](char);
        }
        fixture.detectChanges();
        expect(store.searchContent).not.toHaveBeenCalled();

        jest.advanceTimersByTime(300);
        expect(store.searchContent).toHaveBeenCalledWith(
            expect.objectContaining({ term: 'dun' })
        );
    });

    it('does not search below the minimum query length, and clears results instead', async () => {
        jest.useFakeTimers();
        const { fixture, store } = await setup();
        fixture.detectChanges();

        fixture.componentInstance['onCharEntered']('d');
        fixture.componentInstance['onCharEntered']('u');
        fixture.detectChanges();
        jest.advanceTimersByTime(300);

        expect(store.searchContent).not.toHaveBeenCalled();
        expect(store.resetSearchResults).toHaveBeenCalled();
    });

    it('renders results in a grid once the store returns them', async () => {
        const { fixture, store } = await setup();
        fixture.detectChanges();
        fixture.componentInstance['onCharEntered']('d');
        fixture.componentInstance['onCharEntered']('u');
        fixture.componentInstance['onCharEntered']('n');
        store.searchResults.set([searchItem(1, 'Dune')]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-poster-grid')
        ).toBeTruthy();
        expect(fixture.nativeElement.textContent).toContain('Dune');
    });

    it('renders the empty state when a long-enough query returns nothing', async () => {
        const { fixture, store } = await setup();
        fixture.detectChanges();
        fixture.componentInstance['onCharEntered']('x');
        fixture.componentInstance['onCharEntered']('y');
        fixture.componentInstance['onCharEntered']('z');
        store.searchResults.set([]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
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

    it('activating a result navigates to its detail route', async () => {
        const { fixture, store, router } = await setup();
        const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
        fixture.detectChanges();
        fixture.componentInstance['onCharEntered']('d');
        fixture.componentInstance['onCharEntered']('u');
        fixture.componentInstance['onCharEntered']('n');
        store.searchResults.set([searchItem(7, 'Dune', 'series')]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('lib-tv-poster-card');
        card.click();

        expect(navigateSpy).toHaveBeenCalledWith([
            '/tv',
            'xtreams',
            PLAYLIST_ID,
            'detail',
            'series',
            '7',
        ]);
    });

    it('navigating results after a re-sorted result set lands on the right item — the group orders by DOM position, not registration order', async () => {
        const { fixture, store, focusService } = await setup();
        fixture.detectChanges();
        fixture.componentInstance['onCharEntered']('d');
        fixture.componentInstance['onCharEntered']('u');
        fixture.componentInstance['onCharEntered']('n');
        store.searchResults.set([
            searchItem(1, 'Alpha'),
            searchItem(2, 'Beta'),
            searchItem(3, 'Gamma'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // A different result set entirely (simulating a re-sort/new query),
        // re-using one id in a different position.
        store.searchResults.set([
            searchItem(3, 'Gamma'),
            searchItem(1, 'Alpha'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        focusService.setActive('tv-search-results', 0);
        expect(
            (focusService.activeElement() as HTMLElement)?.textContent
        ).toContain('Gamma');

        focusService.move('right');
        expect(
            (focusService.activeElement() as HTMLElement)?.textContent
        ).toContain('Alpha');
    });
});
