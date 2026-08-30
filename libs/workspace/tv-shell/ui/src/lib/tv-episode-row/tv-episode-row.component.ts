import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/** One episode entry (§7.5): mapping from the store's episode shape is the caller's job. */
export interface TvEpisodeRowItem {
    readonly id: number;
    readonly episodeNumber: number;
    readonly title: string;
    readonly stillUrl?: string;
    readonly watched: boolean;
}

/**
 * The episode row below the season tabs (§7.5, series only). A `row` focus
 * group; each episode is a focusable card. Activation plays that episode
 * directly (episodes are playable items, not further detail pages).
 */
@Component({
    selector: 'lib-tv-episode-row',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-episode-row.component.html',
    styleUrl: './tv-episode-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-episode-row',
    },
})
export class TvEpisodeRowComponent {
    readonly episodes = input.required<readonly TvEpisodeRowItem[]>();
    readonly episodeActivated = output<TvEpisodeRowItem>();
}
