import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/** One season tab (§7.5): the provider season key, e.g. `"1"`. */
export interface TvSeasonTabItem {
    readonly key: string;
}

/**
 * Season tabs above the episode row (§7.5, series only). A `row` focus
 * group; presentational only — the routed screen owns which season key is
 * currently selected.
 */
@Component({
    selector: 'lib-tv-season-tabs',
    imports: [TvFocusableDirective, TranslateModule],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-season-tabs.component.html',
    styleUrl: './tv-season-tabs.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-season-tabs',
    },
})
export class TvSeasonTabsComponent {
    readonly seasons = input.required<readonly TvSeasonTabItem[]>();
    readonly selectedKey = input<string | undefined>(undefined);
    readonly seasonSelected = output<string>();
}
