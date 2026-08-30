import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import { TvFocusGroupDirective, TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvPosterCardComponent } from '../tv-poster-card/tv-poster-card.component';

/** One poster grid entry (§7.4). Mapping from the store's item shape is the caller's job. */
export interface TvPosterGridItem {
    readonly id: number | string;
    readonly title: string;
    readonly posterUrl?: string;
}

/**
 * The movies/series poster grid (§7.4). A `grid` focus group whose column
 * count is forwarded in by the caller (§7.4 — derived from the viewport at
 * runtime, never hard-coded).
 *
 * Owns the focus-driven `loadMore` trigger (§8.2): once the active item sits
 * in the last currently-rendered row, and the store still reports more
 * content, it asks the caller to grow the render window — the same
 * `loadMore` contract `InfiniteScrollDirective` drives from scroll position,
 * just triggered by focus position instead. Guarded on `hasMore`/`appending`
 * so it fires once per arrival at the last row, not on every change-detection
 * pass while focus sits there.
 */
@Component({
    selector: 'lib-tv-poster-grid',
    imports: [TvPosterCardComponent],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'orientation', 'columnCount', 'neighbours'],
        },
    ],
    templateUrl: './tv-poster-grid.component.html',
    styleUrl: './tv-poster-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-poster-grid',
    },
})
export class TvPosterGridComponent {
    private readonly focusService = inject(TvFocusService);
    private readonly group = inject(TvFocusGroupDirective, { self: true });

    readonly items = input.required<readonly TvPosterGridItem[]>();
    /** Whether the store has more content beyond the current render window. */
    readonly hasMore = input<boolean>(false);
    /** True while a `loadMore` request is already in flight. */
    readonly appending = input<boolean>(false);
    readonly kind = input<'movie' | 'series'>('movie');

    readonly itemActivated = output<TvPosterGridItem>();
    readonly loadMoreRequested = output<void>();

    constructor() {
        effect(() => {
            if (this.focusService.activeGroupId() !== this.group.id) {
                return;
            }

            const itemCount = this.items().length;
            if (itemCount === 0 || this.appending() || !this.hasMore()) {
                return;
            }

            const columns = Math.max(1, this.group.columnCount());
            const activeIndex = this.focusService.activeIndex();
            const lastRowStart = Math.floor((itemCount - 1) / columns) * columns;

            if (activeIndex >= lastRowStart) {
                this.loadMoreRequested.emit();
            }
        });
    }
}
