import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/**
 * The home screen's hero (§7.2): full-bleed backdrop, title and a single
 * focusable resume CTA. Presentational only — the screen decides which item
 * is hero-worthy and what "resume" resolves to (the detail route, which
 * auto-resumes from playback positions on its own — see the detail screen).
 *
 * A `row` focus group of exactly one item, mirroring `tv-episode-row`'s
 * hostDirectives forwarding rather than the catalog rail's, since this group
 * never needs `orientation`/`columnCount` — just `tvFocusGroup` + neighbours.
 */
@Component({
    selector: 'lib-tv-home-hero',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-home-hero.component.html',
    styleUrl: './tv-home-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-home-hero',
    },
})
export class TvHomeHeroComponent {
    readonly title = input.required<string>();
    readonly subtitle = input<string | undefined>(undefined);
    readonly backdropUrl = input<string | undefined>(undefined);
    readonly resumeLabel = input.required<string>();

    readonly resumeActivated = output<void>();
}
