import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    TvCategoryRailComponent,
    type TvCategoryRailItem,
} from './tv-category-rail.component';

const CATEGORIES: TvCategoryRailItem[] = [
    { id: null, label: 'All' },
    { id: 1, label: 'News' },
];

@Component({
    template: `
        <lib-tv-category-rail
            tvFocusGroup="col"
            [orientation]="orientation"
            [categories]="categories"
        />
    `,
    imports: [TvCategoryRailComponent],
})
class HostComponent {
    readonly categories = CATEGORIES;
    orientation: 'row' | 'column' = 'row';
}

describe('TvCategoryRailComponent', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
    });

    it('does not apply the column layout class by default (row rail, §7.4)', () => {
        fixture.detectChanges();
        const host = fixture.nativeElement.querySelector('lib-tv-category-rail');
        expect(host.classList.contains('tv-category-rail--column')).toBe(false);
    });

    it('applies the column layout class when orientation="column" (live category column, §7.3)', () => {
        fixture.componentInstance.orientation = 'column';
        fixture.detectChanges();
        const host = fixture.nativeElement.querySelector('lib-tv-category-rail');
        expect(host.classList.contains('tv-category-rail--column')).toBe(true);
    });
});
