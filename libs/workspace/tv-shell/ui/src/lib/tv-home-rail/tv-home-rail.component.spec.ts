import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    TvHomeRailComponent,
    type TvHomeRailItem,
} from './tv-home-rail.component';

const ITEMS: TvHomeRailItem[] = [
    { id: 1, title: 'Dune', kind: 'movie' },
    { id: 2, title: 'Arcane', kind: 'series', subtitle: 'S01E02' },
];

@Component({
    template: `
        <lib-tv-home-rail
            tvFocusGroup="rail"
            heading="Continue watching"
            [items]="items"
            (itemActivated)="activated = $event"
        />
    `,
    imports: [TvHomeRailComponent],
})
class HostComponent {
    items = ITEMS;
    activated: TvHomeRailItem | null = null;
}

describe('TvHomeRailComponent', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
    });

    it('renders the heading and one card per item', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.tv-home-rail__heading')?.textContent).toBe(
            'Continue watching'
        );
        expect(el.querySelectorAll('lib-tv-poster-card').length).toBe(2);
    });

    it('renders an item subtitle when present', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.textContent).toContain('S01E02');
    });

    it('emits itemActivated with the clicked item', () => {
        const cards: NodeListOf<HTMLElement> =
            fixture.nativeElement.querySelectorAll('lib-tv-poster-card');
        cards[1].click();
        fixture.detectChanges();
        expect(fixture.componentInstance.activated?.id).toBe(2);
    });
});
