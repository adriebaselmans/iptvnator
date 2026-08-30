import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
 * Horizontal category rail above the poster grid (§7.4). A `row` focus
 * group; each category is a focusable button. Presentational only — the
 * routed screen owns which category is currently selected and what
 * selecting one does to the store.
 */
@Component({
    selector: 'lib-tv-category-rail',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
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
    readonly categories = input.required<readonly TvCategoryRailItem[]>();
    readonly selectedCategoryId = input<number | null>(null);
    readonly categorySelected = output<number | null>();

    protected trackById(_index: number, item: TvCategoryRailItem): number | null {
        return item.id;
    }
}
