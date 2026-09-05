import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    input,
    output,
    viewChild,
} from '@angular/core';
import { TvFocusableDirective, TvFocusGroupDirective } from '@iptvnator/ui/tv-navigation';
import type { FocusGroupNeighbours } from '@iptvnator/ui/tv-navigation';
import {
    buildTimeSlots,
    computeTimelineBounds,
    formatSlotTime,
    isNowWithinTimeline,
    nowLineOffsetPx,
    programmeLayout,
    timelineWidthPx,
    type TvEpgProgrammeLayout,
    type TvEpgTimeSlot,
} from './tv-epg-grid.util';

/** One programme cell in an EPG grid row. */
export interface TvEpgGridProgramme {
    readonly id: string;
    readonly title: string;
    readonly startMs: number;
    readonly stopMs: number;
    readonly isCurrent: boolean;
}

/** One channel row in the EPG grid — "channels as rows, programmes as time columns" (§7.3). */
export interface TvEpgGridRow {
    readonly channelId: number;
    readonly channelName: string;
    readonly programmes: readonly TvEpgGridProgramme[];
}

/** Fraction of the viewport width the "now" position is scrolled to from the left edge. */
const NOW_SCROLL_FRACTION = 1 / 3;

/**
 * The live TV EPG grid (§7.3, opened by Right from the channel bar): a
 * timeline grid — a 30-minute time axis header plus programme blocks
 * proportional to their duration (`PIXELS_PER_MINUTE` in `tv-epg-grid.util`)
 * — with a fixed, non-scrolling channel-name column and a synchronized
 * horizontal scroll achieved purely with CSS `position: sticky` (no JS
 * scroll-event syncing).
 *
 * Each channel is still its own `row` focus group of programme cells,
 * stacked vertically with explicit up/down neighbours to the adjacent
 * channel rows — not a single `grid` focus group. A true grid's index
 * arithmetic (`row = index / columnCount`) assumes every row has the same
 * cell count, which does not hold here: each channel airs a different number
 * of programmes across the visible window. Stacked `row` groups reuse the
 * existing focus primitives correctly instead of forcing a mismatched
 * "grid" orientation onto ragged rows (§7.3's own allowance for TV-specific
 * rendering where the desktop timeline ribbon does not fit).
 *
 * OK on any programme cell tunes that cell's channel (`programmeActivated`)
 * — there is no catch-up/timeshift in this phase (§3 non-goals: no context
 * menus), so a future or past cell still just switches the channel, exactly
 * like pressing OK on the channel bar row itself.
 */
@Component({
    selector: 'lib-tv-epg-grid',
    imports: [TvFocusableDirective, TvFocusGroupDirective],
    templateUrl: './tv-epg-grid.component.html',
    styleUrl: './tv-epg-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-epg-grid' },
})
export class TvEpgGridComponent {
    readonly rows = input.required<readonly TvEpgGridRow[]>();
    readonly emptyLabel = input('');
    /** Group id prefix for each channel row (`${groupIdPrefix}-${channelId}`). */
    readonly groupIdPrefix = input.required<string>();
    /** The channel-bar group id every row's `left` neighbour points back to. */
    readonly leftNeighbourGroupId = input.required<string>();
    /** Current time, used to position the "now" indicator and initial scroll. */
    readonly nowMs = input(Date.now());

    readonly programmeActivated = output<TvEpgGridRow>();

    private readonly scrollContainer =
        viewChild<ElementRef<HTMLElement>>('scrollContainer');

    protected readonly timelineBounds = computed(() =>
        computeTimelineBounds(this.rows(), this.nowMs())
    );
    protected readonly timelineStartMs = computed(
        () => this.timelineBounds().startMs
    );
    protected readonly timelineEndMs = computed(() => this.timelineBounds().endMs);
    protected readonly timeSlots = computed<TvEpgTimeSlot[]>(() =>
        buildTimeSlots(this.timelineStartMs(), this.timelineEndMs())
    );
    protected readonly timelineWidthPx = computed(() =>
        timelineWidthPx(this.timelineStartMs(), this.timelineEndMs())
    );
    protected readonly nowOffsetPx = computed(() =>
        nowLineOffsetPx(this.nowMs(), this.timelineStartMs())
    );
    protected readonly nowVisible = computed(() =>
        isNowWithinTimeline(this.nowMs(), this.timelineStartMs(), this.timelineEndMs())
    );

    private hasAutoScrolled = false;

    constructor() {
        // Auto-scrolls once, the first time the timeline has content and the
        // scroll container is available — puts "now" about a third in from
        // the left instead of at the far edge.
        effect(() => {
            const container = this.scrollContainer()?.nativeElement;
            const hasRows = this.rows().length > 0;
            const offset = this.nowOffsetPx();
            if (!container || !hasRows || this.hasAutoScrolled) return;
            this.hasAutoScrolled = true;
            container.scrollLeft = Math.max(
                0,
                offset - container.clientWidth * NOW_SCROLL_FRACTION
            );
        });
    }

    protected trackByChannelId(_index: number, row: TvEpgGridRow): number {
        return row.channelId;
    }

    protected trackByProgrammeId(_index: number, programme: TvEpgGridProgramme): string {
        return programme.id;
    }

    protected rowGroupId(row: TvEpgGridRow): string {
        return `${this.groupIdPrefix()}-${row.channelId}`;
    }

    protected rowNeighbours(index: number): FocusGroupNeighbours {
        const rows = this.rows();
        return {
            left: this.leftNeighbourGroupId(),
            up: index > 0 ? this.rowGroupId(rows[index - 1]) : undefined,
            down:
                index < rows.length - 1
                    ? this.rowGroupId(rows[index + 1])
                    : undefined,
        };
    }

    protected cellLayout(programme: TvEpgGridProgramme): TvEpgProgrammeLayout {
        return programmeLayout(programme, this.timelineStartMs());
    }

    protected formatStartTime(programme: TvEpgGridProgramme): string {
        return formatSlotTime(programme.startMs);
    }

    /** Only show the start-time subtext when the cell is wide enough for it. */
    protected showStartTime(programme: TvEpgGridProgramme): boolean {
        return this.cellLayout(programme).widthPx > 100;
    }
}
