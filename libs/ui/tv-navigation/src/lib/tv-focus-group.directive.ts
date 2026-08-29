import { Directive, inject, input, OnDestroy, OnInit } from '@angular/core';
import type { FocusOrientation } from './tv-focus-geometry';
import type { FocusGroupNeighbours } from './tv-focus-graph';
import { TvFocusService } from './tv-focus.service';

let groupSequence = 0;

/**
 * Declares a TV focus group: an orientation (`row` | `column` | `grid`), an
 * optional runtime column count for grids, and declared neighbour groups per
 * direction. Registers itself with {@link TvFocusService}; the arithmetic for
 * moves within and across groups lives in the pure geometry/graph modules.
 *
 * ```html
 * <div tvFocusGroup="movies-grid" orientation="grid" [columnCount]="columns()"
 *      [neighbours]="{ up: 'movies-rail' }">
 * ```
 */
@Directive({
    selector: '[tvFocusGroup]',
    standalone: true,
})
export class TvFocusGroupDirective implements OnInit, OnDestroy {
    private readonly focusService = inject(TvFocusService);

    /** Explicit group id. Falls back to an auto-generated id when omitted. */
    readonly tvFocusGroup = input<string | undefined>(undefined);
    readonly orientation = input<FocusOrientation>('row');
    /** Column count for `grid` orientation. Re-read on every move, so it may change at runtime. */
    readonly columnCount = input<number>(1);
    readonly neighbours = input<FocusGroupNeighbours>({});

    private readonly autoId = `tv-focus-group-${++groupSequence}`;

    get id(): string {
        return this.tvFocusGroup() ?? this.autoId;
    }

    ngOnInit(): void {
        this.focusService.registerGroup({
            id: this.id,
            orientation: () => this.orientation(),
            columnCount: () => this.columnCount(),
            neighbours: () => this.neighbours(),
        });
    }

    ngOnDestroy(): void {
        this.focusService.unregisterGroup(this.id);
    }
}
