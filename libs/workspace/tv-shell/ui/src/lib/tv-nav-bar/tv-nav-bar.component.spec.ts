import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvNavBarComponent, type TvNavBarItem } from './tv-nav-bar.component';

const ITEMS: TvNavBarItem[] = [
    { id: 'home', label: 'Home' },
    { id: 'live', label: 'Live' },
    { id: 'movies', label: 'Movies' },
];

@Component({
    template: `
        <lib-tv-nav-bar
            tvFocusGroup="nav"
            [items]="items"
            [activeId]="activeId"
            (itemActivated)="activated = $event"
        />
    `,
    imports: [TvNavBarComponent],
})
class HostComponent {
    readonly items = ITEMS;
    activeId: string | null = 'home';
    activated: string | null = null;
}

describe('TvNavBarComponent', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
    });

    it('renders every entry as a focusable button', () => {
        fixture.detectChanges();
        const buttons: HTMLButtonElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('.tv-nav-bar__item')
        );
        expect(buttons.length).toBe(3);
        buttons.forEach((button) => {
            expect(button.hasAttribute('tabindex')).toBe(true);
        });
    });

    it('marks the active section without hiding or disabling the others', () => {
        fixture.detectChanges();
        const active = fixture.nativeElement.querySelector(
            '.tv-nav-bar__item--active'
        );
        expect(active?.textContent).toContain('Home');

        const buttons: HTMLButtonElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('.tv-nav-bar__item')
        );
        buttons.forEach((button) => expect(button.disabled).toBe(false));
    });

    it('emits itemActivated with the clicked entry id', () => {
        fixture.detectChanges();
        const buttons: HTMLButtonElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('.tv-nav-bar__item')
        );
        buttons[2].click();
        expect(fixture.componentInstance.activated).toBe('movies');
    });
});
