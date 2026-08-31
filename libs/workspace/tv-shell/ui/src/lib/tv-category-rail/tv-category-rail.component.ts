import {
    ChangeDetectionStrategy,
    Component,
    HostBinding,
    inject,
    input,
    output,
} from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/** One entry in the category rail (§7.4): "All" plus every provider category. */
export interface TvCategoryRailItem {
    readonly id: number | null;
    readonly label: string;
    readonly count?: number;
}

/**
 * Category list, reused in two layouts: a horizontal `row` rail above the
 * movies/series poster grid (§7.4), and — with `orientation="column"` — the
 * live screen's vertical category column opened from the channel bar (§7.3).
 * Presentational only — the routed screen owns which category is currently
 * selected and what selecting one does to the store.
 */
@Component({
    selector: 'lib-tv-category-rail',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'orientation', 'neighbours'],
        },
    ],
    templateUrl: './tv-category-rail.component.html',
    styleUrl: './tv-category-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-category-rail',
    },
})
export class TvCategoryRailComponent {
    private readonly group = inject(TvFocusGroupDirective, { self: true });

    readonly categories = input.required<readonly TvCategoryRailItem[]>();
    readonly selectedCategoryId = input<number | null>(null);
    readonly categorySelected = output<number | null>();

    /**
     * Reflects the forwarded `orientation` host-directive input (default
     * `row`, the movies/series rail; pass `orientation="column"` for the
     * live category column) so the layout SCSS can switch flex direction.
     */
    @HostBinding('class.tv-category-rail--column')
    get isColumn(): boolean {
        return this.group.orientation() === 'column';
    }

    protected trackById(_index: number, item: TvCategoryRailItem): number | null {
        return item.id;
    }
}
