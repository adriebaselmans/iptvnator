import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvDetailActionRowComponent } from './tv-detail-action-row.component';

async function setup(): Promise<ComponentFixture<TvDetailActionRowComponent>> {
    await TestBed.configureTestingModule({
        imports: [TvDetailActionRowComponent],
    }).compileComponents();
    return TestBed.createComponent(TvDetailActionRowComponent);
}

function buttons(fixture: ComponentFixture<TvDetailActionRowComponent>): HTMLButtonElement[] {
    return Array.from(
        fixture.nativeElement.querySelectorAll('button.tv-detail-action-row__button')
    );
}

describe('TvDetailActionRowComponent', () => {
    it('renders no actions when nothing is supported', async () => {
        const fixture = await setup();
        fixture.detectChanges();
        expect(buttons(fixture).length).toBe(0);
    });

    it('renders only the actions gated on (§7.5 — no dead controls)', async () => {
        const fixture = await setup();
        fixture.componentRef.setInput('canPlay', true);
        fixture.componentRef.setInput('playLabel', 'Play');
        fixture.componentRef.setInput('canFavorite', true);
        fixture.componentRef.setInput('favoriteLabel', 'Favorite');
        fixture.detectChanges();

        const rendered = buttons(fixture).map((button) => button.textContent?.trim());
        expect(rendered).toEqual(['Play', 'Favorite']);
    });

    it('renders every action when every capability is supported, each focusable', async () => {
        const fixture = await setup();
        fixture.componentRef.setInput('canPlay', true);
        fixture.componentRef.setInput('playLabel', 'Resume');
        fixture.componentRef.setInput('canFavorite', true);
        fixture.componentRef.setInput('favoriteLabel', 'Favorite');
        fixture.componentRef.setInput('canDownload', true);
        fixture.componentRef.setInput('downloadLabel', 'Download');
        fixture.componentRef.setInput('canMarkWatched', true);
        fixture.componentRef.setInput('markWatchedLabel', 'Mark watched');
        fixture.detectChanges();

        const rendered = buttons(fixture);
        expect(rendered.map((button) => button.textContent?.trim())).toEqual([
            'Resume',
            'Favorite',
            'Download',
            'Mark watched',
        ]);
        // Every rendered action is a real focusable control (`tvFocusable`
        // manages `tabindex`) — none is a hidden/disabled dead control.
        for (const button of rendered) {
            expect(button.hasAttribute('tabindex')).toBe(true);
        }
    });

    it('emits playActivated on click', async () => {
        const fixture = await setup();
        fixture.componentRef.setInput('canPlay', true);
        fixture.detectChanges();
        const emitted = jest.fn();
        fixture.componentInstance.playActivated.subscribe(emitted);

        buttons(fixture)[0].click();
        expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('emits favoriteToggled/downloadActivated/markWatchedToggled on click', async () => {
        const fixture = await setup();
        fixture.componentRef.setInput('canFavorite', true);
        fixture.componentRef.setInput('canDownload', true);
        fixture.componentRef.setInput('canMarkWatched', true);
        fixture.detectChanges();

        const favorite = jest.fn();
        const download = jest.fn();
        const markWatched = jest.fn();
        fixture.componentInstance.favoriteToggled.subscribe(favorite);
        fixture.componentInstance.downloadActivated.subscribe(download);
        fixture.componentInstance.markWatchedToggled.subscribe(markWatched);

        const [favoriteBtn, downloadBtn, markWatchedBtn] = buttons(fixture);
        favoriteBtn.click();
        downloadBtn.click();
        markWatchedBtn.click();

        expect(favorite).toHaveBeenCalledTimes(1);
        expect(download).toHaveBeenCalledTimes(1);
        expect(markWatched).toHaveBeenCalledTimes(1);
    });
});
