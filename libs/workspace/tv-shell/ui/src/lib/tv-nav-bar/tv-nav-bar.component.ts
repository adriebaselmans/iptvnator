import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/** One entry in the persistent top navigation row (design correction #18). */
export interface TvNavBarItem {
    readonly id: string;
    readonly label: string;
}

/**
 * The shell's persistent top navigation row: a plain `row` focus group of
 * section entries (Home/Live/Movies/Series/Search), rendered above a
 * screen's own content so every section stays reachable without going back
 * to Home first. Presentational only — the routed screen decides which
 * sections exist, what each one is labelled and routes to, and which entry
 * is "current" (§6.4: the current screen's entry stays focusable like any
 * other, it is not hidden or disabled).
 */
@Component({
    selector: 'lib-tv-nav-bar',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'neighbours'],
        },
    ],
    templateUrl: './tv-nav-bar.component.html',
    styleUrl: './tv-nav-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-nav-bar',
    },
})
export class TvNavBarComponent {
    readonly items = input.required<readonly TvNavBarItem[]>();
    readonly activeId = input<string | null>(null);

    readonly itemActivated = output<string>();

    protected trackById(_index: number, item: TvNavBarItem): string {
        return item.id;
    }
}
