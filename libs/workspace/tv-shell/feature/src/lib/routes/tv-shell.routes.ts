import { Route } from '@angular/router';

type ComponentLoader = NonNullable<Route['loadComponent']>;

const loadTvShellComponent: ComponentLoader = () =>
    import('../tv-shell/tv-shell.component').then((c) => c.TvShellComponent);

const loadTvSourcePickerComponent: ComponentLoader = () =>
    import('../source-picker/tv-source-picker.component').then(
        (c) => c.TvSourcePickerComponent
    );

const loadTvCatalogScreenComponent: ComponentLoader = () =>
    import('../catalog/tv-catalog-screen.component').then(
        (c) => c.TvCatalogScreenComponent
    );

const loadTvDetailScreenComponent: ComponentLoader = () =>
    import('../detail/tv-detail-screen.component').then(
        (c) => c.TvDetailScreenComponent
    );

const loadTvLiveScreenComponent: ComponentLoader = () =>
    import('../live/tv-live-screen.component').then(
        (c) => c.TvLiveScreenComponent
    );

const loadTvHomeScreenComponent: ComponentLoader = () =>
    import('../home/tv-home-screen.component').then(
        (c) => c.TvHomeScreenComponent
    );

const loadTvSearchScreenComponent: ComponentLoader = () =>
    import('../search/tv-search-screen.component').then(
        (c) => c.TvSearchScreenComponent
    );

/**
 * The `/tv` route subtree (§5.2). Mirrors the workspace's Xtream route
 * shape (`xtreams/:id/...`) so a future "open this item in the other shell"
 * mapping stays trivial.
 *
 * The source picker (`''`) is a Phase 2 screen; `movies`/`series` are Phase
 * 3a (§7.4, `TvCatalogScreenComponent`, driven by route `data.tvCatalogType`).
 * `detail/:type/:itemId` is Phase 3b (§7.5, `TvDetailScreenComponent`).
 * `live` is Phase 5 (§7.3, `TvLiveScreenComponent`). `home` and `search` are
 * Phase 6 (§7.2/§7.6, `TvHomeScreenComponent`/`TvSearchScreenComponent`).
 */
export function createTvRoutes(): Route[] {
    return [
        {
            path: '',
            loadComponent: loadTvShellComponent,
            children: [
                {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: loadTvSourcePickerComponent,
                },
                {
                    path: 'xtreams/:id/home',
                    data: { tvScreen: 'home' },
                    loadComponent: loadTvHomeScreenComponent,
                },
                {
                    path: 'xtreams/:id/live',
                    data: { tvScreen: 'live' },
                    loadComponent: loadTvLiveScreenComponent,
                },
                {
                    path: 'xtreams/:id/movies',
                    data: { tvScreen: 'movies', tvCatalogType: 'vod' },
                    loadComponent: loadTvCatalogScreenComponent,
                },
                {
                    path: 'xtreams/:id/series',
                    data: { tvScreen: 'series', tvCatalogType: 'series' },
                    loadComponent: loadTvCatalogScreenComponent,
                },
                {
                    path: 'xtreams/:id/search',
                    data: { tvScreen: 'search' },
                    loadComponent: loadTvSearchScreenComponent,
                },
                {
                    path: 'xtreams/:id/detail/:type/:itemId',
                    data: { tvScreen: 'detail' },
                    loadComponent: loadTvDetailScreenComponent,
                },
            ],
        },
    ];
}
