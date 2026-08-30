import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/**
 * The detail page's focusable action row (§6.4, §7.5): every secondary
 * action a six-key remote needs to reach is a real button here, never a
 * hidden menu. Each action is gated by its own `can*` input — an action the
 * store cannot support for the current item is structurally absent rather
 * than rendered disabled, per §7.5 ("rather than rendering dead controls").
 *
 * Presentational only: the routed screen decides what each `can*` flag is
 * and what each output does.
 */
@Component({
    selector: 'lib-tv-detail-action-row',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-detail-action-row.component.html',
    styleUrl: './tv-detail-action-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-detail-action-row',
    },
})
export class TvDetailActionRowComponent {
    readonly canPlay = input(false);
    readonly playLabel = input('');
    readonly canFavorite = input(false);
    readonly favoriteLabel = input('');
    readonly isFavorite = input(false);
    readonly canDownload = input(false);
    readonly downloadLabel = input('');
    readonly canMarkWatched = input(false);
    readonly markWatchedLabel = input('');
    readonly isWatched = input(false);

    readonly playActivated = output<void>();
    readonly favoriteToggled = output<void>();
    readonly downloadActivated = output<void>();
    readonly markWatchedToggled = output<void>();
}
