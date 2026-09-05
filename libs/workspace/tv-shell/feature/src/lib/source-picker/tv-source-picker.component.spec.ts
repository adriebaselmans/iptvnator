import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { PlaylistActions, selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { TvSourcePickerComponent } from './tv-source-picker.component';

function xtreamPlaylist(id: string): PlaylistMeta {
    return {
        _id: id,
        title: `Source ${id}`,
        serverUrl: 'http://example.com',
        username: 'user',
        password: 'pass',
    } as PlaylistMeta;
}

async function setup(
    playlists: PlaylistMeta[],
    options?: { addPlaylistFails?: boolean }
): Promise<{
    fixture: ComponentFixture<TvSourcePickerComponent>;
    router: Router;
    playlistsService: { addPlaylist: jest.Mock };
    store: MockStore;
}> {
    const playlistsService = {
        addPlaylist: options?.addPlaylistFails
            ? jest.fn().mockReturnValue(throwError(() => new Error('fail')))
            : jest.fn().mockImplementation((playlist) => of(playlist)),
    };

    await TestBed.configureTestingModule({
        imports: [
            TvSourcePickerComponent,
            RouterTestingModule.withRoutes([]),
            TranslateModule.forRoot(),
        ],
        providers: [
            provideMockStore({
                selectors: [
                    { selector: selectAllPlaylistsMeta, value: playlists },
                ],
            }),
            { provide: PlaylistsService, useValue: playlistsService },
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TvSourcePickerComponent);
    const router = TestBed.inject(Router);
    const store = TestBed.inject(MockStore);
    return { fixture, router, playlistsService, store };
}

describe('TvSourcePickerComponent', () => {
    afterEach(() => {
        TestBed.inject(MockStore).resetSelectors();
    });

    it('lists every Xtream source as a focusable card', async () => {
        const { fixture } = await setup([
            xtreamPlaylist('a'),
            xtreamPlaylist('b'),
            xtreamPlaylist('c'),
        ]);
        fixture.detectChanges();

        const cards = fixture.nativeElement.querySelectorAll(
            '[data-test-id="tv-source-picker-card"]'
        );
        expect(cards.length).toBe(3);
        cards.forEach((card: HTMLElement) => {
            expect(card.hasAttribute('tabindex')).toBe(true);
        });
    });

    it('redirects straight to home when exactly one Xtream source exists', async () => {
        const { fixture, router } = await setup([xtreamPlaylist('only')]);
        const navigateSpy = jest
            .spyOn(router, 'navigate')
            .mockResolvedValue(true);

        fixture.detectChanges();

        expect(navigateSpy).toHaveBeenCalledWith([
            '/tv/xtreams',
            'only',
            'home',
        ]);
    });

    it('does not redirect with zero sources', async () => {
        const { fixture: emptyFixture, router: emptyRouter } =
            await setup([]);
        const emptyNavigateSpy = jest.spyOn(emptyRouter, 'navigate');
        emptyFixture.detectChanges();
        expect(emptyNavigateSpy).not.toHaveBeenCalled();
    });

    it('does not redirect with multiple sources', async () => {
        const { fixture: multiFixture, router: multiRouter } = await setup([
            xtreamPlaylist('a'),
            xtreamPlaylist('b'),
        ]);
        const multiNavigateSpy = jest.spyOn(multiRouter, 'navigate');
        multiFixture.detectChanges();
        expect(multiNavigateSpy).not.toHaveBeenCalled();
    });

    // Regression for correction #17: with more than one source the screen
    // never redirects, so nothing was ever focused and neither arrow keys
    // nor OK could do anything — TvFocusService.move()/activateFocusedElement()
    // both no-op while activeGroupId() is null.
    it('focuses the first card once multiple sources have resolved, so arrow keys and OK can operate the screen', async () => {
        const { fixture } = await setup([
            xtreamPlaylist('a'),
            xtreamPlaylist('b'),
            xtreamPlaylist('c'),
        ]);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const focusService = TestBed.inject(TvFocusService);
        expect(focusService.activeGroupId()).toBe('tv-source-picker');
        expect(focusService.activeIndex()).toBe(0);

        focusService.move('right');
        expect(focusService.activeIndex()).toBe(1);

        const cards: HTMLButtonElement[] = Array.from(
            fixture.nativeElement.querySelectorAll(
                '[data-test-id="tv-source-picker-card"]'
            )
        );
        expect(focusService.activeElement()).toBe(cards[1]);

        const clickSpy = jest.spyOn(cards[1], 'click');
        (focusService.activeElement() as HTMLButtonElement).click();
        expect(clickSpy).toHaveBeenCalled();
    });

    describe('add source wizard', () => {
        it('shows an "Add source" card even with zero sources, and activating it opens the URL step', async () => {
            const { fixture } = await setup([]);
            fixture.detectChanges();

            const addCard = fixture.nativeElement.querySelector(
                '[data-test-id="tv-source-picker-add-card"]'
            ) as HTMLButtonElement;
            expect(addCard).toBeTruthy();

            addCard.click();
            fixture.detectChanges();

            expect(fixture.componentInstance['wizardStep']()).toBe('url');
            expect(
                fixture.nativeElement.querySelector(
                    '[data-test-id="tv-source-picker-wizard"]'
                )
            ).toBeTruthy();
        });

        it('Next is a no-op on an empty step and shows a validation message', async () => {
            const { fixture } = await setup([]);
            fixture.detectChanges();
            fixture.componentInstance['onAddSourceActivated']();
            fixture.detectChanges();

            fixture.componentInstance['onWizardNext']();
            fixture.detectChanges();

            expect(fixture.componentInstance['wizardStep']()).toBe('url');
            expect(fixture.componentInstance['showValidationError']()).toBe(
                true
            );
        });

        it('rejects a server URL step Next when the URL cannot be normalized', async () => {
            const { fixture } = await setup([]);
            fixture.detectChanges();
            fixture.componentInstance['onAddSourceActivated']();
            fixture.componentInstance['onWizardCharEntered']('n');
            fixture.componentInstance['onWizardCharEntered']('o');
            fixture.componentInstance['onWizardCharEntered']('p');
            fixture.componentInstance['onWizardCharEntered']('e');

            fixture.componentInstance['onWizardNext']();

            expect(fixture.componentInstance['wizardStep']()).toBe('url');
            expect(fixture.componentInstance['showValidationError']()).toBe(
                true
            );
        });

        it('walks Server URL -> Username -> Password on Next, and Back walks the other way to the source cards', async () => {
            const { fixture } = await setup([]);
            fixture.detectChanges();
            const instance = fixture.componentInstance as unknown as Record<
                string,
                (...args: unknown[]) => unknown
            >;

            instance['onAddSourceActivated']();
            'http://example.com:8080'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            expect(instance['wizardStep']()).toBe('username');

            instance['onWizardCharEntered']('u');
            instance['onWizardNext']();
            expect(instance['wizardStep']()).toBe('password');

            instance['onWizardBack']();
            expect(instance['wizardStep']()).toBe('username');

            instance['onWizardBack']();
            expect(instance['wizardStep']()).toBe('url');

            instance['onWizardBack']();
            expect(instance['wizardStep']()).toBe('idle');
        });

        it('masks the password step display as it is typed', async () => {
            const { fixture } = await setup([]);
            fixture.detectChanges();
            const instance = fixture.componentInstance as unknown as Record<
                string,
                (...args: unknown[]) => unknown
            >;

            instance['onAddSourceActivated']();
            'http://example.com'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            'user'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            expect(instance['wizardStep']()).toBe('password');

            instance['onWizardCharEntered']('p');
            instance['onWizardCharEntered']('w');

            expect(instance['currentInputValue']()).toBe('••');
        });

        it('Connect persists the playlist, syncs NgRx state and navigates to the new source home', async () => {
            const { fixture, router, playlistsService, store } =
                await setup([]);
            const dispatchSpy = jest.spyOn(store, 'dispatch');
            const navigateSpy = jest
                .spyOn(router, 'navigate')
                .mockResolvedValue(true);
            fixture.detectChanges();
            const instance = fixture.componentInstance as unknown as Record<
                string,
                (...args: unknown[]) => unknown
            >;

            instance['onAddSourceActivated']();
            'http://example.com'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            'user'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            'pass'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));

            await instance['onConnect']();

            expect(playlistsService.addPlaylist).toHaveBeenCalledTimes(1);
            const savedPlaylist = playlistsService.addPlaylist.mock
                .calls[0][0];
            expect(savedPlaylist.serverUrl).toBe('http://example.com');
            expect(savedPlaylist.username).toBe('user');
            expect(savedPlaylist.password).toBe('pass');

            expect(dispatchSpy).toHaveBeenCalledWith(
                PlaylistActions.loadPlaylists()
            );
            expect(navigateSpy).toHaveBeenCalledWith([
                '/tv/xtreams',
                savedPlaylist._id,
                'home',
            ]);
        });

        it('Connect surfaces an error and returns to the password step when persistence fails', async () => {
            const { fixture } = await setup([], { addPlaylistFails: true });
            fixture.detectChanges();
            const instance = fixture.componentInstance as unknown as Record<
                string,
                (...args: unknown[]) => unknown
            >;

            instance['onAddSourceActivated']();
            'http://example.com'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            'user'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));
            instance['onWizardNext']();
            'pass'
                .split('')
                .forEach((char) => instance['onWizardCharEntered'](char));

            await instance['onConnect']();

            expect(instance['wizardStep']()).toBe('password');
            expect(instance['connectFailed']()).toBe(true);
        });
    });
});
