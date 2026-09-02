import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { DataService, resetHostConnectivityGuard } from '@iptvnator/services';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvCatalogStateComponent,
    TvKeyboardComponent,
    TvNavBarComponent,
    TvPosterGridComponent,
    computeTvGridColumnCount,
    type TvNavBarItem,
    type TvPosterGridItem,
} from '@iptvnator/workspace/tv-shell/ui';
import {
    TV_NAV_GROUP_ID,
    tvNavRoute,
    tvNavSections,
    type TvNavSectionId,
} from '../nav/tv-nav-bar.util';
import { TvPlaylistSessionService } from '../session/tv-playlist-session.service';
import {
    applyTvKeyboardBackspace,
    applyTvKeyboardChar,
    toTvSearchResultItems,
    TV_SEARCH_MIN_QUERY_LENGTH,
    TV_SEARCH_TYPES,
    type TvSearchResultItem,
} from './tv-search-screen.util';

const KEYBOARD_GROUP_ID = 'tv-search-keyboard';
const RESULTS_GROUP_ID = 'tv-search-results';
const RETRY_GROUP_ID = 'tv-search-state-retry';
/** Mirrors `SearchResultsComponent`'s in-portal debounce (300 ms). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `/tv/xtreams/:id/search` (§7.6): an on-screen keyboard — a fixed-column
 * `grid` focus group, the same index arithmetic as the movies/series poster
 * grid, no special case — above a results grid driven by the store's
 * existing `with-search` feature (§8.1). The keyboard stays mounted through
 * every state (loading/empty/error only replace the results pane below it),
 * because it is the only way this screen can receive input at all.
 *
 * Search results replace the whole set on every keystroke rather than
 * merely reordering it, and `@for` with `track` moves DOM nodes without
 * re-running `ngOnInit` — exactly the case §6.2 correction #1 exists for.
 * Nothing here has to work around it: `TvFocusService` already orders a
 * group's items by real document position rather than registration order,
 * so a fresh result set registers correctly by construction.
 */
@Component({
    selector: 'lib-tv-search-screen',
    imports: [
        TranslateModule,
        TvCatalogStateComponent,
        TvKeyboardComponent,
        TvNavBarComponent,
        TvPosterGridComponent,
    ],
    templateUrl: './tv-search-screen.component.html',
    styleUrl: './tv-search-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-search-screen' },
})
export class TvSearchScreenComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    protected readonly store = inject(XtreamStore);
    private readonly session = inject(TvPlaylistSessionService);
    private readonly translate = inject(TranslateService);
    private readonly focusService = inject(TvFocusService);
    private readonly dataService = inject(DataService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly keyboardGroupId = KEYBOARD_GROUP_ID;
    protected readonly resultsGroupId = RESULTS_GROUP_ID;
    protected readonly retryGroupId = RETRY_GROUP_ID;
    protected readonly navGroupId = TV_NAV_GROUP_ID;
    protected readonly navNeighbours = { down: KEYBOARD_GROUP_ID } as const;

    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );
    protected readonly navItems = computed<TvNavBarItem[]>(() => {
        this.languageTick();
        return tvNavSections().map((section) => ({
            id: section.id,
            label: this.translate.instant(section.labelKey),
        }));
    });

    private readonly gridHost = viewChild<ElementRef<HTMLElement>>('gridHost');
    protected readonly columnCount = signal(computeTvGridColumnCount(0));

    readonly playlistId = toSignal(
        this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
        { initialValue: '' }
    );

    protected readonly query = signal('');
    protected readonly isBootstrapping = signal(false);
    protected readonly bootstrapFailed = signal(false);

    protected readonly hasEnoughQuery = computed(
        () => this.query().trim().length >= TV_SEARCH_MIN_QUERY_LENGTH
    );

    protected readonly results = computed<TvSearchResultItem[]>(() =>
        this.hasEnoughQuery()
            ? toTvSearchResultItems(this.store.searchResults(), this.playlistId())
            : []
    );

    protected readonly isLoading = computed(
        () =>
            this.isBootstrapping() ||
            (this.hasEnoughQuery() && this.store.isSearching())
    );
    protected readonly hasError = computed(() => this.bootstrapFailed());
    protected readonly isEmpty = computed(
        () => !this.isLoading() && !this.hasError() && this.results().length === 0
    );

    protected readonly keyboardNeighbours = computed(() => {
        const up = { up: TV_NAV_GROUP_ID } as const;
        if (this.hasError()) return { ...up, down: RETRY_GROUP_ID };
        if (this.results().length > 0) return { ...up, down: RESULTS_GROUP_ID };
        return up;
    });
    protected readonly resultsNeighbours = { up: KEYBOARD_GROUP_ID } as const;

    private lastBootstrappedPlaylistId: string | null = null;
    private hasSetInitialFocus = false;
    private resizeObserver?: ResizeObserver;

    constructor() {
        effect(() => {
            const playlistId = this.playlistId();
            if (!playlistId) return;
            untracked(() => void this.bootstrap(playlistId));
        });

        // Debounced by query change, mirroring the desktop in-portal search;
        // below the minimum length the store's results are cleared instead
        // of queried.
        effect((onCleanup) => {
            const term = this.query();
            if (term.trim().length < TV_SEARCH_MIN_QUERY_LENGTH) {
                untracked(() => this.store.resetSearchResults());
                return;
            }
            const timer = setTimeout(() => {
                void this.store.searchContent({
                    term,
                    types: [...TV_SEARCH_TYPES],
                });
            }, SEARCH_DEBOUNCE_MS);
            onCleanup(() => clearTimeout(timer));
        });

        // The keyboard group registers itself during the children's own
        // `ngOnInit`, which runs after this constructor. Found chasing a
        // real E2E failure (`tv-keyboard-only.e2e.ts`): a tracked read of
        // `isBootstrapping()` (hoping its false -> true -> false transition
        // forces a second run after the keyboard group has registered) does
        // not actually close the race — Angular flushes effects BEFORE
        // change detection runs, so nothing guarantees the keyboard's
        // `TvFocusGroupDirective.ngOnInit()` has executed by either flush.
        // `TvFocusService.setActive()` then silently no-ops against an
        // unregistered group (by design — see `tv-focus.service.spec.ts`,
        // "setActive is a no-op for an unregistered group"), `queueMicrotask`
        // defers the actual call past that change-detection pass instead,
        // same fix as the catalog/home screens' initial-focus effects and
        // the detail screen's and source picker's original ones.
        effect(() => {
            if (this.hasSetInitialFocus) return;
            this.hasSetInitialFocus = true;
            untracked(() => {
                queueMicrotask(() =>
                    this.focusService.setActive(KEYBOARD_GROUP_ID, 0)
                );
            });
        });

        effect(() => {
            const host = this.gridHost()?.nativeElement;
            this.resizeObserver?.disconnect();
            this.resizeObserver = undefined;
            if (!host) return;

            untracked(() =>
                this.columnCount.set(computeTvGridColumnCount(host.clientWidth))
            );

            if (typeof ResizeObserver === 'undefined') return;
            this.resizeObserver = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? host.clientWidth;
                this.columnCount.set(computeTvGridColumnCount(width));
            });
            this.resizeObserver.observe(host);
        });

        this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    }

    protected onCharEntered(char: string): void {
        this.query.update((current) => applyTvKeyboardChar(current, char));
    }

    protected onBackspace(): void {
        this.query.update((current) => applyTvKeyboardBackspace(current));
    }

    protected onCleared(): void {
        this.query.set('');
    }

    protected onNavItemActivated(sectionId: string): void {
        void this.router.navigate([
            ...tvNavRoute(sectionId as TvNavSectionId, this.playlistId()),
        ]);
    }

    protected onResultActivated(item: TvPosterGridItem): void {
        const route = (item as TvSearchResultItem).route;
        if (route) {
            void this.router.navigate(route as string[]);
        }
    }

    protected onRetry(): void {
        const playlist = this.store.currentPlaylist();
        // Resets HostConnectivityGuard before its first request (§10) —
        // same sanctioned primitive every other TV screen's Retry uses.
        void resetHostConnectivityGuard(
            this.dataService,
            playlist?.serverUrl
        ).then(() => this.bootstrap(this.playlistId(), true));
    }

    private async bootstrap(
        playlistId: string,
        force = false
    ): Promise<void> {
        if (!playlistId) return;
        if (!force && this.lastBootstrappedPlaylistId === playlistId) return;
        this.lastBootstrappedPlaylistId = playlistId;
        this.isBootstrapping.set(true);
        this.bootstrapFailed.set(false);
        try {
            await this.session.ensureBootstrapped(playlistId);
        } catch {
            this.bootstrapFailed.set(true);
            this.isBootstrapping.set(false);
            return;
        }
        this.isBootstrapping.set(false);
    }
}
