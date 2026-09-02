import {
    computed,
    Directive,
    effect,
    ElementRef,
    HostBinding,
    HostListener,
    inject,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { TvFocusGroupDirective } from './tv-focus-group.directive';
import { TvFocusService } from './tv-focus.service';

/**
 * Registers an element into the enclosing {@link TvFocusGroupDirective},
 * manages `tabindex` so only the active item is tab-reachable, applies the
 * `.tv-focused` class when it is the group's active item, and scrolls itself
 * into view when it becomes active.
 *
 * ```html
 * <div tvFocusGroup orientation="row">
 *   <button tvFocusable>Item</button>
 * </div>
 * ```
 */
@Directive({
    selector: '[tvFocusable]',
    standalone: true,
})
export class TvFocusableDirective implements OnInit, OnDestroy {
    private readonly group = inject(TvFocusGroupDirective);
    private readonly focusService = inject(TvFocusService);
    private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Unique registration token — identity survives array mutation, unlike an index. */
    private readonly token: symbol = Symbol('tv-focusable');

    private readonly isActive = computed(() => {
        if (this.focusService.activeGroupId() !== this.group.id) {
            return false;
        }
        const index = this.focusService.itemIndex(this.group.id, this.token);
        return index >= 0 && index === this.focusService.activeIndex();
    });

    @HostBinding('class.tv-focused')
    get focusedClass(): boolean {
        return this.isActive();
    }

    @HostBinding('attr.tabindex')
    get tabIndexAttr(): number {
        return this.isActive() ? 0 : -1;
    }

    constructor() {
        effect(() => {
            if (!this.isActive()) {
                return;
            }
            const element = this.elementRef.nativeElement;

            // `@HostBinding('attr.tabindex')` above reflects `isActive()`
            // too, but effects are not guaranteed to run after Angular has
            // applied host bindings for this same change-detection pass.
            // Set it directly here so the element is guaranteed focusable
            // at the moment `focus()` is called below.
            element.tabIndex = 0;

            // Real DOM focus must follow the service's notion of "active",
            // or `document.activeElement` never leaves whatever last held
            // it (e.g. `<body>`) and a real keydown — which bubbles from
            // the focused element, not from wherever this directive lives
            // in the tree — never reaches the shell's listener. Skip when
            // already focused so we don't fight the browser (e.g. re-firing
            // this effect for an unrelated reason while the user is still
            // on this element).
            if (document.activeElement !== element) {
                element.focus({ preventScroll: true });
            }

            // Guard for environments without scrollIntoView (e.g. jsdom).
            element.scrollIntoView?.({
                block: 'nearest',
                inline: 'nearest',
            });
        });
    }

    ngOnInit(): void {
        this.focusService.registerItem(
            this.group.id,
            this.token,
            this.elementRef.nativeElement
        );
    }

    ngOnDestroy(): void {
        this.focusService.unregisterItem(this.group.id, this.token);
    }

    /** Programmatically claims focus for this item, e.g. on pointer interaction. */
    @HostListener('click')
    focusNow(): void {
        const index = this.focusService.itemIndex(this.group.id, this.token);
        if (index >= 0) {
            this.focusService.setActive(this.group.id, index);
        }
    }
}
