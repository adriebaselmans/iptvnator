import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { DataService, DownloadsService } from '@iptvnator/services';
import { CONNECTIVITY_GUARD_RESET } from '@iptvnator/shared/interfaces';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import { TvDetailScreenComponent } from './tv-detail-screen.component';

interface FakeXtreamStore {
    selectedItem: ReturnType<typeof signal<unknown>>;
    isFavorite: ReturnType<typeof signal<boolean>>;
    isLoadingDetails: ReturnType<typeof signal<boolean>>;
    detailsError: ReturnType<typeof signal<string | null>>;
    selectedCategoryId: ReturnType<typeof signal<number | null>>;
    playbackPositions: ReturnType<typeof signal<Map<string, { updatedAt?: string }>>>;
    currentPlaylist: ReturnType<typeof signal<unknown>>;
    isInProgress: jest.Mock;
    isWatched: jest.Mock;
    fetchVodDetailsWithMetadata: jest.Mock;
    fetchSerialDetailsWithMetadata: jest.Mock;
    checkFavoriteStatus: jest.Mock;
    loadVodPosition: jest.Mock;
    loadSeriesPositions: jest.Mock;
    enrichSelectedSerialSeason: jest.Mock;
    constructVodStreamUrl: jest.Mock;
    constructEpisodeStreamUrl: jest.Mock;
    toggleFavorite: jest.Mock;
    savePosition: jest.Mock;
    selectedContentType: ReturnType<typeof signal<string>>;
    streamUrl: ReturnType<typeof signal<string | null>>;
    resetPlayer: jest.Mock;
}

function createFakeStore(): FakeXtreamStore {
    return {
        selectedItem: signal<unknown>(null),
        isFavorite: signal(false),
        isLoadingDetails: signal(false),
        detailsError: signal<string | null>(null),
        selectedCategoryId: signal<number | null>(null),
        playbackPositions: signal(new Map()),
        currentPlaylist: signal<unknown>({
            id: 'p1',
            name: 'My Source',
            serverUrl: 'http://host',
            username: 'u',
            password: 'p',
        }),
        isInProgress: jest.fn(() => false),
        isWatched: jest.fn(() => false),
        fetchVodDetailsWithMetadata: jest.fn(),
        fetchSerialDetailsWithMetadata: jest.fn(),
        checkFavoriteStatus: jest.fn(),
        loadVodPosition: jest.fn(() => Promise.resolve()),
        loadSeriesPositions: jest.fn(() => Promise.resolve()),
        enrichSelectedSerialSeason: jest.fn(),
        constructVodStreamUrl: jest.fn(() => 'http://stream'),
        constructEpisodeStreamUrl: jest.fn(() => 'http://stream/ep'),
        toggleFavorite: jest.fn(),
        savePosition: jest.fn(() => Promise.resolve()),
        selectedContentType: signal('vod'),
        streamUrl: signal<string | null>(null),
        resetPlayer: jest.fn(),
    };
}

async function setup(params: {
    type: 'movie' | 'series';
    itemId: string;
}): Promise<{
    fixture: ComponentFixture<TvDetailScreenComponent>;
    store: FakeXtreamStore;
    session: { ensureBootstrapped: jest.Mock };
    downloads: { isAvailable: ReturnType<typeof signal<boolean>>; startDownload: jest.Mock };
    dataService: { sendIpcEvent: jest.Mock };
}> {
    const store = createFakeStore();
    const session = { ensureBootstrapped: jest.fn().mockResolvedValue(undefined) };
    const downloads = {
        isAvailable: signal(true),
        startDownload: jest.fn().mockResolvedValue({ success: true }),
    };
    const dataService = { sendIpcEvent: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
        imports: [
            TvDetailScreenComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: XtreamStore, useValue: store },
            { provide: TvPlaylistSessionService, useValue: session },
            { provide: DownloadsService, useValue: downloads },
            { provide: DataService, useValue: dataService },
            {
                provide: ActivatedRoute,
                useValue: {
                    paramMap: of(
                        new Map([
                            ['id', 'p1'],
                            ['type', params.type],
                            ['itemId', params.itemId],
                        ])
                    ),
                },
            },
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TvDetailScreenComponent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, store: store as any, session, downloads, dataService };
}

describe('TvDetailScreenComponent', () => {
    it('renders the loading state while details are loading', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.isLoadingDetails.set(true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-detail-hero')
        ).toBeFalsy();
    });

    it('renders the error state and Retry resets the connectivity guard before reloading', async () => {
        const { fixture, store, dataService } = await setup({
            type: 'movie',
            itemId: '100',
        });
        store.detailsError.set('boom');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const retryButton = fixture.nativeElement.querySelector(
            '.tv-catalog-state__retry'
        );
        expect(retryButton).toBeTruthy();

        store.fetchVodDetailsWithMetadata.mockClear();
        retryButton.click();
        await fixture.whenStable();

        const resetCallIndex = dataService.sendIpcEvent.mock.calls.findIndex(
            ([channel]) => channel === CONNECTIVITY_GUARD_RESET
        );
        expect(resetCallIndex).toBeGreaterThanOrEqual(0);
        expect(store.fetchVodDetailsWithMetadata).toHaveBeenCalled();
    });

    it('renders the empty state once resolved with no matching item', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.isLoadingDetails.set(false);
        store.selectedItem.set(null);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-catalog-state')
        ).toBeTruthy();
    });

    it('renders the movie hero and gates Play/Download on a resolvable source', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.selectedItem.set({
            movie_data: { stream_id: 100, container_extension: 'mp4' },
            info: { name: 'A Movie', plot: 'plot text' },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const hero = fixture.nativeElement.querySelector('lib-tv-detail-hero');
        expect(hero).toBeTruthy();
        const actionRow = fixture.nativeElement.querySelector(
            'lib-tv-detail-action-row'
        );
        expect(actionRow).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-season-tabs')
        ).toBeFalsy();
    });

    it('does not offer Play/Download without a resolvable playback source', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.selectedItem.set({
            movie_data: { stream_id: 100, container_extension: '' },
            info: { name: 'A Movie' },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.componentInstance['actionGating']().canPlay
        ).toBe(false);
        expect(
            fixture.componentInstance['actionGating']().canDownload
        ).toBe(false);
    });

    it('toggles favorite through the store with the resolved backdrop', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.selectedItem.set({
            movie_data: { stream_id: 100, container_extension: 'mp4' },
            info: { name: 'A Movie', backdrop_path: ['bd.png'] },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onFavoriteToggled']();
        expect(store.toggleFavorite).toHaveBeenCalledWith(
            '100',
            'p1',
            'movie',
            'bd.png'
        );
    });

    it('resolves and records playback intent through the store on Play (Phase 4 seam)', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        const item = {
            movie_data: { stream_id: 100, container_extension: 'mp4' },
            info: { name: 'A Movie' },
        };
        store.selectedItem.set(item);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.componentInstance['onPlayActivated']();
        expect(store.constructVodStreamUrl).toHaveBeenCalledWith(item);
    });

    describe('playback overlay wiring (§9, Phase 4)', () => {
        beforeEach(() => {
            jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(
                undefined
            );
            jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
                () => undefined
            );
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('mounts the playback overlay honouring a stored resume position on Play', async () => {
            const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
            store.selectedItem.set({
                movie_data: { stream_id: 100, container_extension: 'mp4' },
                info: { name: 'A Movie' },
            });
            store.playbackPositions.set(
                new Map([
                    [
                        'vod_100',
                        {
                            contentXtreamId: 100,
                            contentType: 'vod',
                            positionSeconds: 321,
                        },
                    ],
                ])
            );
            store.streamUrl.set('http://host/movie/100.mp4');
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            fixture.componentInstance['onPlayActivated']();
            fixture.detectChanges();

            const overlay = fixture.nativeElement.querySelector(
                'lib-tv-playback-overlay'
            );
            expect(overlay).toBeTruthy();
            expect(fixture.componentInstance['playbackResumeSeconds']()).toBe(321);
        });

        it('saves progress against the now-playing item', async () => {
            const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
            store.selectedItem.set({
                movie_data: { stream_id: 100, container_extension: 'mp4' },
                info: { name: 'A Movie' },
            });
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            fixture.componentInstance['onPlayActivated']();
            fixture.componentInstance['onPlaybackProgress']({
                positionSeconds: 42,
                durationSeconds: 7200,
            });

            expect(store.savePosition).toHaveBeenCalledWith('p1', {
                playlistId: 'p1',
                contentXtreamId: 100,
                contentType: 'vod',
                positionSeconds: 42,
                durationSeconds: 7200,
            });
        });

        it('closes the overlay and resets the store player on exit', async () => {
            const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
            store.selectedItem.set({
                movie_data: { stream_id: 100, container_extension: 'mp4' },
                info: { name: 'A Movie' },
            });
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            fixture.componentInstance['onPlayActivated']();
            fixture.detectChanges();
            expect(fixture.componentInstance['isPlaying']()).toBe(true);

            fixture.componentInstance['onPlaybackExited']();
            fixture.detectChanges();

            expect(fixture.componentInstance['isPlaying']()).toBe(false);
            expect(store.resetPlayer).toHaveBeenCalledTimes(1);
        });
    });

    it('renders season tabs and an episode row for series, auto-selecting a season', async () => {
        const { fixture, store } = await setup({ type: 'series', itemId: '200' });
        store.selectedItem.set({
            series_id: 200,
            info: { name: 'A Show' },
            episodes: {
                '1': [
                    {
                        id: '1',
                        episode_num: 1,
                        title: 'Ep 1',
                        container_extension: 'mp4',
                        info: [],
                        custom_sid: '',
                        added: '',
                        season: 1,
                        direct_source: '',
                    },
                ],
                '2': [
                    {
                        id: '2',
                        episode_num: 1,
                        title: 'Ep 2.1',
                        container_extension: 'mp4',
                        info: [],
                        custom_sid: '',
                        added: '',
                        season: 2,
                        direct_source: '',
                    },
                ],
            },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('lib-tv-season-tabs')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('lib-tv-episode-row')
        ).toBeTruthy();
        // Nothing watched/in-progress -> earliest season with unwatched episodes (season 1).
        expect(fixture.componentInstance['selectedSeasonKey']()).toBe('1');
    });

    // Regression: TvDetailScreenComponent never called
    // TvFocusService.setActive() at all — arriving here from the poster
    // grid/rail (which nulls the active group on teardown) left nothing
    // focused, so a remote-only user could reach the detail page and then be
    // unable to press OK on Play/Resume.
    it('focuses the action row primary action (Play) once the movie resolves', async () => {
        const { fixture, store } = await setup({ type: 'movie', itemId: '100' });
        store.selectedItem.set({
            movie_data: { stream_id: 100, container_extension: 'mp4' },
            info: { name: 'A Movie', plot: 'plot text' },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const focusService = TestBed.inject(TvFocusService);
        expect(focusService.activeGroupId()).toBe('tv-detail-actions');
        expect(focusService.activeIndex()).toBe(0);

        const playButton = fixture.nativeElement.querySelector(
            '.tv-detail-action-row__button--primary'
        );
        expect(playButton).toBeTruthy();
        expect(focusService.activeElement()).toBe(playButton);
    });

    it('bootstraps through the shared session for the resolved playlist id', async () => {
        const { fixture, session, store } = await setup({
            type: 'movie',
            itemId: '100',
        });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(session.ensureBootstrapped).toHaveBeenCalledWith('p1');
        expect(store.fetchVodDetailsWithMetadata).toHaveBeenCalledWith({
            vodId: '100',
            categoryId: 0,
        });
    });
});
