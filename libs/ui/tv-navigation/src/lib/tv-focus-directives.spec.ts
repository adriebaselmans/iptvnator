import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TvFocusGroupDirective } from './tv-focus-group.directive';
import { TvFocusableDirective } from './tv-focusable.directive';
import { TvFocusService } from './tv-focus.service';

@Component({
    template: `
        <div
            tvFocusGroup="rail"
            orientation="row"
            [neighbours]="{ down: 'grid' }"
        >
            @for (item of railItems(); track item) {
                <button tvFocusable>{{ item }}</button>
            }
        </div>
        <div
            tvFocusGroup="grid"
            orientation="grid"
            [columnCount]="columnCount()"
        >
            @for (item of gridItems(); track item) {
                <div tvFocusable>{{ item }}</div>
            }
        </div>
    `,
    imports: [TvFocusGroupDirective, TvFocusableDirective],
})
class TestHostComponent {
    readonly railItems = signal(['a', 'b', 'c']);
    readonly gridItems = signal(['1', '2', '3', '4', '5', '6']);
    readonly columnCount = signal(3);
}

describe('TvFocusGroupDirective + TvFocusableDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let service: TvFocusService;
    let scrollIntoViewSpy: jest.Mock;

    beforeEach(async () => {
        scrollIntoViewSpy = jest.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        service = TestBed.inject(TvFocusService);
        fixture.detectChanges();
    });

    function railButtons(): HTMLElement[] {
        return fixture.debugElement
            .queryAll(By.css('[tvFocusGroup="rail"] [tvFocusable]'))
            .map((el) => el.nativeElement as HTMLElement);
    }

    function gridItemsEls(): HTMLElement[] {
        return fixture.debugElement
            .queryAll(By.css('[tvFocusGroup="grid"] [tvFocusable]'))
            .map((el) => el.nativeElement as HTMLElement);
    }

    it('registers every tvFocusable element under its enclosing group', () => {
        service.setActive('rail', 0);
        fixture.detectChanges();
        expect(railButtons()[0].classList.contains('tv-focused')).toBe(true);

        service.setActive('grid', 4);
        fixture.detectChanges();
        expect(gridItemsEls()[4].classList.contains('tv-focused')).toBe(true);
        // The rail item is no longer active once focus moved to the grid.
        expect(railButtons()[0].classList.contains('tv-focused')).toBe(false);
    });

    it('applies tabindex 0 only to the active item and -1 to the rest', () => {
        service.setActive('rail', 1);
        fixture.detectChanges();

        const buttons = railButtons();
        expect(buttons[0].getAttribute('tabindex')).toBe('-1');
        expect(buttons[1].getAttribute('tabindex')).toBe('0');
        expect(buttons[2].getAttribute('tabindex')).toBe('-1');
    });

    it('no item carries the active class before anything is focused', () => {
        for (const el of [...railButtons(), ...gridItemsEls()]) {
            expect(el.classList.contains('tv-focused')).toBe(false);
        }
    });

    it('scrolls the newly active element into view', () => {
        scrollIntoViewSpy.mockClear();

        service.setActive('rail', 2);
        fixture.detectChanges();

        expect(scrollIntoViewSpy).toHaveBeenCalledWith(
            expect.objectContaining({ block: 'nearest', inline: 'nearest' })
        );
    });

    it('a click on an item claims focus for it via the service', () => {
        railButtons()[2].click();
        fixture.detectChanges();

        expect(service.activeGroupId()).toBe('rail');
        expect(service.activeIndex()).toBe(2);
        expect(railButtons()[2].classList.contains('tv-focused')).toBe(true);
    });

    it('delegates arrow moves through TvFocusService, moving within the rail', () => {
        service.setActive('rail', 0);
        fixture.detectChanges();

        service.move('right');
        fixture.detectChanges();

        expect(railButtons()[1].classList.contains('tv-focused')).toBe(true);
        expect(railButtons()[0].classList.contains('tv-focused')).toBe(false);
    });

    it('delegates cross-group moves: exiting the rail downward enters the grid', () => {
        service.setActive('rail', 1);
        fixture.detectChanges();

        service.move('down');
        fixture.detectChanges();

        expect(service.activeGroupId()).toBe('grid');
        // Column position (1) preserved entering the grid's top row.
        expect(service.activeIndex()).toBe(1);
        expect(gridItemsEls()[1].classList.contains('tv-focused')).toBe(true);
    });

    it('a runtime column-count change is honoured by subsequent moves', () => {
        service.setActive('grid', 1);
        fixture.detectChanges();

        service.move('down');
        // columnCount 3: index 1 -> index 4.
        expect(service.activeIndex()).toBe(4);

        fixture.componentInstance.columnCount.set(2);
        fixture.detectChanges();
        service.setActive('grid', 1);

        service.move('down');
        // columnCount 2: index 1 -> index 3.
        expect(service.activeIndex()).toBe(3);
    });

    it('unregisters an item when it is removed from the DOM and reindexes the rest', () => {
        service.setActive('rail', 2);
        fixture.detectChanges();
        expect(railButtons()[2].textContent?.trim()).toBe('c');

        fixture.componentInstance.railItems.set(['a', 'b']);
        fixture.detectChanges();

        expect(railButtons().length).toBe(2);
        // The group now has only 2 items; moving right from index 1 exits it.
        service.setActive('rail', 1);
        service.move('right');
        expect(service.activeGroupId()).toBe('rail');
        expect(service.activeIndex()).toBe(1);
    });
});
