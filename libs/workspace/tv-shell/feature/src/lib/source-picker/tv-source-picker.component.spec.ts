import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
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
});
