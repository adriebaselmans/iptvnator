import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    HostListener,
    inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { mapTvKeyToIntent } from './tv-key-intent.util';

/**
 * The routed `/tv` shell root (§5.3/§6.3 of the TV shell design). Owns the
 * single root `keydown` listener that translates the six-key remote
 * vocabulary into navigation intents and delegates the arithmetic to
 * {@link TvFocusService}. Screens must never attach their own keydown
 * listeners — this is the only place key handling lives.
 */
@Component({
    selector: 'lib-tv-shell',
    imports: [RouterOutlet],
    templateUrl: './tv-shell.component.html',
    styleUrl: './tv-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-shell',
    },
})
export class TvShellComponent {
    private readonly focusService = inject(TvFocusService);
    private readonly location = inject(Location);

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        const intent = mapTvKeyToIntent(event.key);
        if (!intent) {
            return;
        }

        event.preventDefault();

        switch (intent.kind) {
            case 'move':
                this.focusService.move(intent.direction);
                break;
            case 'activate':
                this.activateFocusedElement();
                break;
            case 'back':
                this.goBack();
                break;
        }
    }

    /**
     * OK always activates whatever currently holds focus (§6.4 "no hidden
     * actions" — every reachable action is a real focusable element, so a
     * click is always the right activation).
     *
     * The target comes from {@link TvFocusService}, never from a subtree
     * query for `.tv-focused` (§6.3): overlays render into the CDK overlay
     * container outside this component's subtree, where such a query would
     * find nothing and OK would silently do nothing.
     */
    private activateFocusedElement(): void {
        const element = this.focusService.activeElement();
        if (element instanceof HTMLElement) {
            element.click();
        }
    }

    /**
     * Pops navigation. The home-root "prompt to leave TV mode" behaviour
     * (§6.1) is deferred to the phase that builds the home screen — there is
     * nothing to prompt from yet with only placeholder screens routed.
     */
    private goBack(): void {
        this.location.back();
    }
}
