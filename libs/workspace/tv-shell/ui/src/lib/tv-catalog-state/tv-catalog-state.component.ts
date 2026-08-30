import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TvFocusableDirective, TvFocusGroupDirective } from '@iptvnator/ui/tv-navigation';

/**
 * Loading / empty / error placeholder for a TV catalogue screen (§10). The
 * error state's Retry is a real focusable element — its own `row` focus
 * group, so it stays reachable regardless of what group was active when the
 * screen tipped into an error.
 */
@Component({
    selector: 'lib-tv-catalog-state',
    imports: [TvFocusableDirective, TvFocusGroupDirective],
    templateUrl: './tv-catalog-state.component.html',
    styleUrl: './tv-catalog-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-catalog-state',
    },
})
export class TvCatalogStateComponent {
    readonly variant = input.required<'loading' | 'empty' | 'error'>();
    readonly title = input.required<string>();
    readonly description = input<string | undefined>(undefined);
    readonly retryLabel = input<string | undefined>(undefined);
    readonly retryGroupId = input<string>('tv-catalog-state-retry');

    readonly retry = output<void>();
}
