import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    effect,
    inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { mapTvKeyToIntent } from './tv-key-intent.util';
import { mapTvPlaybackKeyToIntent } from '../playback/tv-playback-key-intent.util';
import {
    TvPlaybackSession,
    TvPlaybackSessionService,
} from '../playback/tv-playback-session.service';

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
        tabindex: '-1',
    },
})
export class TvShellComponent {
    private readonly focusService = inject(TvFocusService);
    private readonly location = inject(Location);
    private readonly playbackSession = inject(TvPlaybackSessionService);
    private readonly elementRef =
        inject<ElementRef<HTMLElement>>(ElementRef);

    constructor() {
        // The shell root is the DOM focus holder of last resort: before any
        // screen's `tvFocusGroup` has claimed an active item (first paint,
        // and the gap between one screen tearing its groups down on
        // navigation and the next screen registering its own), nothing
        // else holds real DOM focus. Left unhandled, `document.activeElement`
        // falls back to `<body>` — an ancestor of this component, not a
        // descendant — so a real keydown never bubbles into this listener
        // at all. `TvFocusableDirective` moves focus onto the active item
        // once one exists; this effect reclaims it here whenever none does.
        effect(() => {
            if (!this.focusService.activeElement()) {
                const element = this.elementRef.nativeElement;
                if (document.activeElement !== element) {
                    element.focus({ preventScroll: true });
                }
            }
        });
    }

    @HostListener('keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        const session = this.playbackSession.active();
        if (session && !session.isOverlayActive?.()) {
            this.handlePlaybackKey(event, session);
            return;
        }

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
                // While a session-owned overlay (channel bar, category
                // column, EPG grid) has claimed the key stream, Back closes
                // it instead of popping route navigation (§7.3 "Back
                // closes").
                if (session) {
                    session.onOverlayBack?.();
                } else {
                    this.goBack();
                }
                break;
        }
    }

    /**
     * While a playback session is mounted, the six-key vocabulary means
     * something different (§9.2): OK toggles play/pause and reveals
     * controls, Left/Right seek (VOD only, gated the same way the desktop
     * shortcuts gate seek — capability plus a currently seekable state),
     * Up/Down change channel during live playback, and Back exits playback
     * instead of popping navigation. The mapping lives in
     * `tv-playback-key-intent.util.ts`; this method only routes the result
     * to the registered controller (§6.3: the shell owns key handling).
     */
    private handlePlaybackKey(
        event: KeyboardEvent,
        session: TvPlaybackSession
    ): void {
        const intent = mapTvPlaybackKeyToIntent(event.key, session.isLive());
        if (!intent) {
            return;
        }

        event.preventDefault();

        switch (intent.kind) {
            case 'toggle-play':
                session.reveal();
                session.controller.commands.togglePlay();
                break;
            case 'seek':
                session.reveal();
                if (
                    session.controller.capabilities().seek &&
                    session.controller.state().canSeek
                ) {
                    session.controller.commands.seekBy(intent.deltaSeconds);
                }
                break;
            case 'channel':
                session.onChannelChange?.(intent.direction);
                break;
            case 'open-channel-bar':
                session.onOpenChannelBar?.();
                break;
            case 'exit':
                session.onExit();
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
