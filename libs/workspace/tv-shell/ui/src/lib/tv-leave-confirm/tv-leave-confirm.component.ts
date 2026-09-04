import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
} from '@iptvnator/ui/tv-navigation';

/**
 * The confirmation shown when Back is pressed at TV mode's root (Home) and
 * there is nowhere left to pop navigation into — closes the gap noted at
 * design time (§6.1: "the home-root 'prompt to leave TV mode' behaviour is
 * deferred") and never built, which left Back at Home a silent no-op with no
 * way back to the desktop workspace short of quitting the app.
 *
 * Own `row` focus group, own two `tvFocusable` buttons. `Stay` is index 0
 * (the caller activates it, not this component — mirrors every other
 * `TvFocusService.setActive()` call in this shell), so an accidental double
 * Back cannot exit TV mode on its own: the first Back only opens this
 * prompt, and reaching `Exit` requires an explicit Right/Enter past the safe
 * default.
 */
@Component({
    selector: 'lib-tv-leave-confirm',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'orientation'],
        },
    ],
    templateUrl: './tv-leave-confirm.component.html',
    styleUrl: './tv-leave-confirm.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-leave-confirm' },
})
export class TvLeaveConfirmComponent {
    readonly title = input.required<string>();
    readonly description = input<string | undefined>(undefined);
    readonly stayLabel = input.required<string>();
    readonly exitLabel = input.required<string>();

    readonly stay = output<void>();
    readonly exit = output<void>();
}
