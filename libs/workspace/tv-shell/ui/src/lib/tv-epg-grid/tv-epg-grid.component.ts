import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TvFocusableDirective, TvFocusGroupDirective } from '@iptvnator/ui/tv-navigation';
import type { FocusGroupNeighbours } from '@iptvnator/ui/tv-navigation';

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

/**
 * The live TV EPG grid (§7.3, opened by Right from the channel bar): each
 * channel is its own `row` focus group of programme cells, stacked
 * vertically with explicit up/down neighbours to the adjacent channel rows —
 * not a single `grid` focus group. A true grid's index arithmetic
 * (`row = index / columnCount`) assumes every row has the same cell count,
 * which does not hold here: each channel airs a different number of
 * programmes across the visible window. Stacked `row` groups reuse the
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

    readonly programmeActivated = output<TvEpgGridRow>();

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
}
