import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TvFocusGroupDirective } from '@iptvnator/ui/tv-navigation';
import { TvPosterCardComponent } from '../tv-poster-card/tv-poster-card.component';
import type { TvPosterGridItem } from '../tv-poster-grid/tv-poster-grid.component';

/** One home rail entry — the poster grid's item shape, plus an optional subtitle line. */
export type TvHomeRailItem = TvPosterGridItem & {
    readonly subtitle?: string;
    readonly kind?: 'movie' | 'series';
};

/**
 * A single horizontal rail on the home screen (§7.2): "Continue watching",
 * "Recently added", "Favourites", "Live now", and — when TMDB is enabled —
 * "Trending" and "Because you watched". A plain `row` focus group of poster
 * cards, reusing `TvPosterCardComponent` exactly as the catalogue grid does.
 *
 * Unlike the catalogue's poster grid this never triggers `loadMore` — every
 * rail here is a short, pre-loaded slice already capped by the screen.
 */
@Component({
    selector: 'lib-tv-home-rail',
    imports: [TvPosterCardComponent],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-home-rail.component.html',
    styleUrl: './tv-home-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-home-rail',
    },
})
export class TvHomeRailComponent {
    readonly heading = input.required<string>();
    readonly items = input.required<readonly TvHomeRailItem[]>();

    readonly itemActivated = output<TvHomeRailItem>();

    protected trackById(
        _index: number,
        item: TvHomeRailItem
    ): TvPosterGridItem['id'] {
        return item.id;
    }
}
