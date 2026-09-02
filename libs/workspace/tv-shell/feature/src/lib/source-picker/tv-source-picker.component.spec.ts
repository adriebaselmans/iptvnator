import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
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
    playlists: PlaylistMeta[]
): Promise<{
    fixture: ComponentFixture<TvSourcePickerComponent>;
    router: Router;
}> {
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
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TvSourcePickerComponent);
    const router = TestBed.inject(Router);
    return { fixture, router };
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
});
