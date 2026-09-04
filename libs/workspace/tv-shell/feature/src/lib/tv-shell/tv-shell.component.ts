import { Location } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    effect,
    inject,
    signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvLeaveConfirmComponent } from '@iptvnator/workspace/tv-shell/ui';
import { TV_NAV_GROUP_ID } from '../nav/tv-nav-bar.util';
import { mapTvKeyToIntent } from './tv-key-intent.util';
import { isTvHomeRoute } from './tv-shell-route.util';
import { mapTvPlaybackKeyToIntent } from '../playback/tv-playback-key-intent.util';
import {
    TvPlaybackSession,
    TvPlaybackSessionService,
} from '../playback/tv-playback-session.service';

const LEAVE_CONFIRM_GROUP_ID = 'tv-leave-confirm';

/**
 * The routed `/tv` shell root (§5.3/§6.3 of the TV shell design). Owns the
 * single root `keydown` listener that translates the six-key remote
 * vocabulary into navigation intents and delegates the arithmetic to
 * {@link TvFocusService}. Screens must never attach their own keydown
 * listeners — this is the only place key handling lives.
 */
@Component({
    selector: 'lib-tv-shell',
    imports: [RouterOutlet, TvLeaveConfirmComponent, TranslateModule],
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
    private readonly router = inject(Router);
    private readonly playbackSession = inject(TvPlaybackSessionService);
    private readonly elementRef =
        inject<ElementRef<HTMLElement>>(ElementRef);

    /**
     * The Back-at-Home confirmation (§6.1, correction: this was designed but
     * never built, leaving Back at Home a silent no-op — there was no
     * earlier route to pop into, and no way back to the desktop workspace
     * short of quitting the app). Own focus group, own `setActive()` call
     * below, exactly the pattern every other overlay/error state in this
     * shell already uses.
     */
    protected readonly showLeaveConfirm = signal(false);
    protected readonly leaveConfirmGroupId = LEAVE_CONFIRM_GROUP_ID;

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

        // `TvLeaveConfirmComponent` registers its own focus group when it
        // mounts (`@if (showLeaveConfirm())` in the template), but
        // registering a group never makes it active on its own (§6.4) — the
        // exact gap Phase 8's audit found and fixed for every other overlay
        // in this shell. `queueMicrotask` matches that established pattern:
        // the group's `ngOnInit` has not run yet the first time this effect
        // sees `showLeaveConfirm()` turn true, since Angular flushes effects
        // before the change-detection pass that mounts the `@if` branch.
        effect(() => {
            if (this.showLeaveConfirm()) {
                queueMicrotask(() =>
                    this.focusService.setActive(this.leaveConfirmGroupId, 0)
                );
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
                if (this.showLeaveConfirm()) {
                    // A second Back while the confirm is open cancels it —
                    // Back means "step back" consistently everywhere in
                    // this shell, never "confirm the destructive choice".
                    this.onStayInTvMode();
                } else if (session) {
                    // While a session-owned overlay (channel bar, category
                    // column, EPG grid) has claimed the key stream, Back
                    // closes it instead of popping route navigation (§7.3
                    // "Back closes").
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
     * Pops navigation, except at TV mode's root (Home): there is nothing
     * earlier to pop into there, so `location.back()` would be a silent
     * no-op, and the only way out of TV mode would be quitting the app.
     * Opens the leave confirmation instead (§6.1).
     */
    private goBack(): void {
        if (isTvHomeRoute(this.router.url)) {
            this.showLeaveConfirm.set(true);
            return;
        }
        this.location.back();
    }

    /** Closes the confirmation without leaving TV mode. */
    protected onStayInTvMode(): void {
        this.showLeaveConfirm.set(false);
        // The confirm's own group is gone the moment this signal flips (its
        // `@if` unmounts, `TvFocusGroupDirective.ngOnDestroy` unregisters
        // it), which would otherwise leave nothing active — the nav bar's
        // Home entry is always index 0 there and always mounted on Home,
        // the only screen this confirm ever opens from, so it is the one
        // restore target that is always valid.
        this.focusService.setActive(TV_NAV_GROUP_ID, 0);
    }

    /**
     * Leaves TV mode for the desktop workspace. Not a settings write —
     * `startInTvMode` is untouched, so the next TV launch still starts here.
     */
    protected onExitTvMode(): void {
        this.showLeaveConfirm.set(false);
        void this.router.navigateByUrl('/workspace');
    }
}
