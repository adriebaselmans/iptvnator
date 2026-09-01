import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from '@angular/core';
import { TvFocusableDirective } from '@iptvnator/ui/tv-navigation';

/**
 * A single poster in the movies/series grid (§7.4). Presentational only —
 * selection and navigation are owned by the routed screen.
 *
 * `tvFocusable` (registered via `hostDirectives`) manages the host's
 * `tabindex`/`.tv-focused` class, and the shell's `element.click()`
 * activation (§6.3) works against any clickable host — so this stays a plain
 * element with `role="button"` rather than a native `<button>`.
 *
 * The poster image loads lazily inside a fixed-aspect box (§8.2) so a slow
 * image never shifts the grid — and therefore never shifts focus — under the
 * user; a failed/pending load keeps the box's placeholder background instead
 * of collapsing.
 */
@Component({
    selector: 'lib-tv-poster-card',
    imports: [],
    hostDirectives: [TvFocusableDirective],
    templateUrl: './tv-poster-card.component.html',
    styleUrl: './tv-poster-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-poster-card',
        role: 'button',
    },
})
export class TvPosterCardComponent {
    readonly title = input.required<string>();
    readonly posterUrl = input<string | undefined>(undefined);
    /** Rendered as a fallback badge/icon when there is no poster image. */
    readonly kind = input<'movie' | 'series'>('movie');
    /**
     * Optional line under the title — e.g. a live channel's current
     * programme (§7.2 "Live now" rail, fed through `EpgQueueService`).
     * Omitted entirely when absent, so every other consumer is unaffected.
     */
    readonly subtitle = input<string | undefined>(undefined);

    protected readonly imageFailed = signal(false);

    protected onImageError(): void {
        this.imageFailed.set(true);
    }
}
