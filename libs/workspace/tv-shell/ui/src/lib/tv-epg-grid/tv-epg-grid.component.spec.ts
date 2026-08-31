import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    TvFocusService,
} from '@iptvnator/ui/tv-navigation';
import { TvEpgGridComponent, type TvEpgGridRow } from './tv-epg-grid.component';

function row(channelId: number, programmeCount: number): TvEpgGridRow {
    return {
        channelId,
        channelName: `Channel ${channelId}`,
        programmes: Array.from({ length: programmeCount }, (_, index) => ({
            id: `${channelId}-${index}`,
            title: `Programme ${index}`,
            startMs: index * 1000,
            stopMs: (index + 1) * 1000,
            isCurrent: index === 0,
        })),
    };
}

@Component({
    template: `
        <div tvFocusGroup="channel-bar" orientation="column">
            <button tvFocusable>Channel</button>
        </div>
        <lib-tv-epg-grid
            [rows]="rows()"
            emptyLabel="No guide data"
            groupIdPrefix="epg-row"
            leftNeighbourGroupId="channel-bar"
            (programmeActivated)="onActivated($event)"
        />
    `,
    imports: [TvEpgGridComponent, TvFocusableDirective, TvFocusGroupDirective],
})
class HostComponent {
    readonly rows = signal<TvEpgGridRow[]>([row(1, 2), row(2, 1)]);
    activated: TvEpgGridRow | null = null;

    onActivated(activatedRow: TvEpgGridRow): void {
        this.activated = activatedRow;
    }
}

describe('TvEpgGridComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let focusService: TvFocusService;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        focusService = TestBed.inject(TvFocusService);
        fixture.detectChanges();
    });

    it('renders one row per channel and one cell per programme', () => {
        const rows = fixture.nativeElement.querySelectorAll('.tv-epg-grid__row');
        expect(rows.length).toBe(2);
        expect(rows[0].querySelectorAll('.tv-epg-grid__cell').length).toBe(2);
        expect(rows[1].querySelectorAll('.tv-epg-grid__cell').length).toBe(1);
    });

    it('renders the empty state when there are no rows', () => {
        host.rows.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-grid__empty').textContent
        ).toContain('No guide data');
        expect(
            fixture.nativeElement.querySelector('.tv-epg-grid__row')
        ).toBeFalsy();
    });

    it('emits programmeActivated with the owning row when a cell is clicked', () => {
        const cell = fixture.nativeElement.querySelector('.tv-epg-grid__cell');
        cell.click();
        expect(host.activated?.channelId).toBe(1);
    });

    it('wires up/down neighbours between adjacent channel rows, not a shared grid group', () => {
        // Each channel is its own `row` focus group (not a single `grid`
        // group) because rows have different cell counts (§7.3 doc comment).
        focusService.setActive('epg-row-1', 0);
        focusService.move('down');

        // Moving down from channel 1's row exits into channel 2's row via
        // the declared neighbour, landing on its first (only) cell.
        expect(focusService.activeGroupId()).toBe('epg-row-2');
    });

    it('wires every row\'s left neighbour back to the channel bar', () => {
        focusService.setActive('epg-row-2', 0);
        focusService.move('left');

        expect(focusService.activeGroupId()).toBe('channel-bar');
    });
});
