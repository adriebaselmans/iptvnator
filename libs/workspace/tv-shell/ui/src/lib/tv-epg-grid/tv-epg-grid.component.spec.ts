import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    TvFocusService,
} from '@iptvnator/ui/tv-navigation';
import { TvEpgGridComponent, type TvEpgGridRow } from './tv-epg-grid.component';

const HOUR_MS = 60 * 60_000;
const BASE_MS = new Date(2026, 0, 1, 18, 0, 0, 0).getTime();

function row(channelId: number, programmeCount: number): TvEpgGridRow {
    return {
        channelId,
        channelName: `Channel ${channelId}`,
        programmes: Array.from({ length: programmeCount }, (_, index) => ({
            id: `${channelId}-${index}`,
            title: `Programme ${index}`,
            startMs: BASE_MS + index * HOUR_MS,
            stopMs: BASE_MS + (index + 1) * HOUR_MS,
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
            [nowMs]="nowMs()"
            (programmeActivated)="onActivated($event)"
        />
    `,
    imports: [TvEpgGridComponent, TvFocusableDirective, TvFocusGroupDirective],
})
class HostComponent {
    readonly rows = signal<TvEpgGridRow[]>([row(1, 2), row(2, 1)]);
    readonly nowMs = signal(BASE_MS + 30 * 60_000);
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
        const rows = fixture.nativeElement.querySelectorAll('.tv-epg-timeline__row');
        expect(rows.length).toBe(2);
        expect(rows[0].querySelectorAll('.tv-epg-timeline__cell').length).toBe(2);
        expect(rows[1].querySelectorAll('.tv-epg-timeline__cell').length).toBe(1);
    });

    it('renders 30-minute time slot markers spanning the programme range', () => {
        const slots = fixture.nativeElement.querySelectorAll('.tv-epg-timeline__slot');
        // Row 1 spans 18:00-20:00; the timeline floors/ceils to slot marks,
        // so there are at least five 30-min markers (18:00..20:00).
        expect(slots.length).toBeGreaterThanOrEqual(5);
        expect(slots[0].textContent.trim()).toBe('18:00');
    });

    it('positions programme cells proportionally to duration (4px/min)', () => {
        const cell = fixture.nativeElement.querySelector('.tv-epg-timeline__cell');
        // First programme starts exactly at the floored timeline start, so
        // left offset is 0; a 60-minute programme is 240px wide.
        expect(cell.style.left).toBe('0px');
        expect(cell.style.width).toBe('240px');
    });

    it('renders a now-line positioned relative to the timeline start', () => {
        const nowLine = fixture.nativeElement.querySelector(
            '.tv-epg-timeline__now-line'
        );
        expect(nowLine).toBeTruthy();
        // nowMs is 30 minutes after the first programme's start (which is
        // also the floored timeline start), so the offset is 120px.
        expect(nowLine.style.left).toBe('120px');
    });

    it('renders the empty state when there are no rows', () => {
        host.rows.set([]);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-epg-grid__empty').textContent
        ).toContain('No guide data');
        expect(
            fixture.nativeElement.querySelector('.tv-epg-timeline__row')
        ).toBeFalsy();
    });

    it('emits programmeActivated with the owning row when a cell is clicked', () => {
        const cell = fixture.nativeElement.querySelector('.tv-epg-timeline__cell');
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
