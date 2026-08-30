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
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvCatalogStateComponent,
    TvCategoryRailComponent,
    TvPosterGridComponent,
    computeTvGridColumnCount,
    type TvPosterGridItem,
} from '@iptvnator/workspace/tv-shell/ui';
import {
    buildTvCategoryRailItems,
    toTvCatalogDetailType,
    toTvPosterGridItem,
    toTvXtreamPlaylistData,
    type TvCatalogContentType,
} from './tv-catalog-screen.util';

const RAIL_GROUP_ID = 'tv-catalog-rail';
const GRID_GROUP_ID = 'tv-catalog-grid';

/**
 * `/tv/xtreams/:id/movies` and `/tv/xtreams/:id/series` (§7.4): a category
 * rail above a poster grid, sharing the same screen driven by route data
 * (`tvCatalogType`). Consumes `XtreamStore` exactly as the desktop workspace
 * does — no new store, no new persistence (§8.1).
 */
@Component({
    selector: 'lib-tv-catalog-screen',
    imports: [
        TranslateModule,
        TvCatalogStateComponent,
        TvCategoryRailComponent,
        TvPosterGridComponent,
    ],
    templateUrl: './tv-catalog-screen.component.html',
    styleUrl: './tv-catalog-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-catalog-screen',
    },
})
export class TvCatalogScreenComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly ngrxStore = inject(Store);
    private readonly store = inject(XtreamStore);
    private readonly translate = inject(TranslateService);
    private readonly focusService = inject(TvFocusService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly railGroupId = RAIL_GROUP_ID;
    protected readonly gridGroupId = GRID_GROUP_ID;
    protected readonly railNeighbours = { down: GRID_GROUP_ID } as const;
    protected readonly gridNeighbours = { up: RAIL_GROUP_ID } as const;

    private readonly gridHost =
        viewChild<ElementRef<HTMLElement>>('gridHost');

    private readonly playlists = this.ngrxStore.selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );

    readonly playlistId = toSignal(
        this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
        { initialValue: '' }
    );
    readonly contentType = toSignal(
        this.route.data.pipe(
            map(
                (data) =>
                    (data['tvCatalogType'] as TvCatalogContentType) ?? 'vod'
            )
        ),
        { initialValue: 'vod' as TvCatalogContentType }
    );

    readonly columnCount = signal(computeTvGridColumnCount(0));

    protected readonly gridKind = computed<'movie' | 'series'>(() =>
        this.contentType() === 'vod' ? 'movie' : 'series'
    );
    protected readonly titleKey = computed(() =>
        this.contentType() === 'vod'
            ? 'TV.CATALOG.TITLE_MOVIES'
            : 'TV.CATALOG.TITLE_SERIES'
    );
    protected readonly selectedCategoryId = computed(() =>
        this.store.selectedCategoryId()
    );
    protected readonly railItems = computed(() => {
        this.languageTick();
        return buildTvCategoryRailItems(
            this.store.getCategoriesBySelectedType(),
            this.store.getCategoryItemCounts(),
            this.translate.instant('TV.CATALOG.ALL_CATEGORIES')
        );
    });
    protected readonly gridItems = computed<TvPosterGridItem[]>(() =>
        this.store
            .getPaginatedContent()
            .map(toTvPosterGridItem)
            .filter((item): item is TvPosterGridItem => item !== null)
    );
    protected readonly hasMore = computed(() => this.store.hasMoreContent());
    protected readonly isLoading = computed(() =>
        this.store.isPaginatedContentLoading()
    );
    protected readonly errorReason = computed(() =>
        this.store.contentInitBlockReason()
    );
    protected readonly isEmpty = computed(
        () =>
            !this.isLoading() &&
            !this.errorReason() &&
            this.gridItems().length === 0
    );

    private lastBootstrappedKey: string | null = null;
    private hasSetInitialFocus = false;
    private resizeObserver?: ResizeObserver;

    constructor() {
        effect(() => {
            const playlistId = this.playlistId();
            const contentType = this.contentType();
            if (!playlistId) {
                return;
            }
            const key = `${playlistId}:${contentType}`;
            untracked(() => {
                if (this.lastBootstrappedKey === key) {
                    return;
                }
                this.lastBootstrappedKey = key;
                void this.bootstrap(playlistId, contentType);
            });
        });

        effect(() => {
            if (this.hasSetInitialFocus) {
                return;
            }
            if (this.isLoading() || this.errorReason()) {
                return;
            }
            if (this.gridItems().length === 0 && this.railItems().length <= 1) {
                return;
            }
            untracked(() => {
                this.hasSetInitialFocus = true;
                this.focusService.setActive(RAIL_GROUP_ID, 0);
            });
        });

        // The grid host only exists once the "ready" template branch renders
        // (§7.4) — which happens after the async store bootstrap resolves,
        // not at initial view creation. `viewChild()` returns a signal, so
        // reacting to it here (rather than in `ngAfterViewInit`, which fires
        // exactly once) re-attaches the observer whenever the host element
        // appears or is torn down by the loading/empty/error branches.
        effect(() => {
            const host = this.gridHost()?.nativeElement;
            this.resizeObserver?.disconnect();
            this.resizeObserver = undefined;
            if (!host) {
                return;
            }

            untracked(() => {
                this.columnCount.set(computeTvGridColumnCount(host.clientWidth));
            });

            if (typeof ResizeObserver === 'undefined') {
                return;
            }

            this.resizeObserver = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? host.clientWidth;
                this.columnCount.set(computeTvGridColumnCount(width));
            });
            this.resizeObserver.observe(host);
        });

        this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    }

    protected onCategorySelected(categoryId: number | null): void {
        this.store.setSelectedCategory(categoryId);
    }

    protected onItemActivated(item: TvPosterGridItem): void {
        const detailType = toTvCatalogDetailType(this.contentType());
        void this.router.navigate([
            '/tv/xtreams',
            this.playlistId(),
            'detail',
            detailType,
            item.id,
        ]);
    }

    protected onLoadMore(): void {
        this.store.loadMoreContent();
    }

    protected onRetry(): void {
        // Resets HostConnectivityGuard before its first request (§10) —
        // handled inside retryContentInitialization() itself, which is why
        // Retry calls that store method rather than initializeContent().
        void this.store.retryContentInitialization();
    }

    private async bootstrap(
        playlistId: string,
        contentType: TvCatalogContentType
    ): Promise<void> {
        const needsPlaylistLoad =
            this.store.playlistId() !== playlistId ||
            this.store.currentPlaylist()?.id !== playlistId;

        if (needsPlaylistLoad) {
            const meta =
                this.playlists().find(
                    (playlist: PlaylistMeta) => playlist._id === playlistId
                ) ?? null;
            const playlistData = toTvXtreamPlaylistData(meta);
            if (!playlistData) {
                return;
            }

            this.store.resetStore(playlistId);
            this.store.setCurrentPlaylist(playlistData);
            await this.store.fetchXtreamPlaylist();
            await this.store.checkPortalStatus();
        }

        this.store.setSelectedContentType(contentType);

        if (needsPlaylistLoad || !this.store.isContentInitialized()) {
            await this.store.initializeContent();
        }
    }
}
