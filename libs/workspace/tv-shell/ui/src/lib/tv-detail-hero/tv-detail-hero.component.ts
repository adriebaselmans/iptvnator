import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One metadata chip rendered under the title (year, genre, rating, duration). */
export interface TvDetailHeroChip {
    readonly label: string;
}

/**
 * The detail page's hero (§7.5): full-bleed backdrop, poster, title, chips
 * and plot. Purely presentational — no focus of its own; the action row,
 * season tabs and episode row are separate focus groups stacked below it.
 */
@Component({
    selector: 'lib-tv-detail-hero',
    imports: [],
    templateUrl: './tv-detail-hero.component.html',
    styleUrl: './tv-detail-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-detail-hero',
    },
})
export class TvDetailHeroComponent {
    readonly title = input.required<string>();
    readonly plot = input<string>('');
    readonly posterUrl = input<string | undefined>(undefined);
    readonly backdropUrl = input<string | undefined>(undefined);
    readonly chips = input<readonly TvDetailHeroChip[]>([]);
}
