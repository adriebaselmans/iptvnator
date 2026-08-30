import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvPosterGridComponent,
    type TvPosterGridItem,
} from './tv-poster-grid.component';

function makeItems(count: number): TvPosterGridItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: index,
        title: `Item ${index}`,
    }));
}

@Component({
    template: `
        <lib-tv-poster-grid
            tvFocusGroup="test-grid"
            orientation="grid"
            [columnCount]="columnCount()"
            [items]="items()"
            [hasMore]="hasMore()"
            [appending]="appending()"
            (loadMoreRequested)="loadMoreRequested()"
        />
    `,
    imports: [TvPosterGridComponent],
})
class HostComponent {
    readonly columnCount = signal(6);
    readonly items = signal<TvPosterGridItem[]>(makeItems(12));
    readonly hasMore = signal(true);
    readonly appending = signal(false);
    loadMoreCallCount = 0;

    loadMoreRequested(): void {
        this.loadMoreCallCount++;
    }
}

describe('TvPosterGridComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let focusService: TvFocusService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HostComponent],
        });
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        focusService = TestBed.inject(TvFocusService);
        fixture.detectChanges();
    });

    it('does not request loadMore while focus is outside the group', () => {
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(0);
    });

    it('requests loadMore exactly once when focus reaches the last loaded row', () => {
        // 12 items, 6 columns => rows [0..5], [6..11]. Entering index 6 (row 2)
        // is the last currently-loaded row.
        focusService.setActive('test-grid', 6);
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(1);

        // Focus stays put; no new emission on a redundant change-detection pass.
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(1);
    });

    it('does not request loadMore while not yet in the last row', () => {
        focusService.setActive('test-grid', 0);
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(0);
    });

    it('does not request loadMore when the store reports no more content', () => {
        host.hasMore.set(false);
        fixture.detectChanges();

        focusService.setActive('test-grid', 6);
        fixture.detectChanges();

        expect(host.loadMoreCallCount).toBe(0);
    });

    it('does not request loadMore again while an append is already in flight', () => {
        host.appending.set(true);
        fixture.detectChanges();

        focusService.setActive('test-grid', 6);
        fixture.detectChanges();

        expect(host.loadMoreCallCount).toBe(0);
    });

    it('re-evaluates against the grown window after items are appended', () => {
        focusService.setActive('test-grid', 6);
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(1);

        // Simulate the store growing the render window; focus (index 6) is
        // no longer in the last row of the larger list, so no further call
        // happens until focus advances again.
        host.items.set(makeItems(24));
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(1);

        focusService.setActive('test-grid', 18);
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(2);
    });
});
