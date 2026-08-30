import { Route } from '@angular/router';

type ComponentLoader = NonNullable<Route['loadComponent']>;

const loadTvShellComponent: ComponentLoader = () =>
    import('../tv-shell/tv-shell.component').then((c) => c.TvShellComponent);

const loadTvSourcePickerComponent: ComponentLoader = () =>
    import('../source-picker/tv-source-picker.component').then(
        (c) => c.TvSourcePickerComponent
    );

const loadTvPlaceholderScreenComponent: ComponentLoader = () =>
    import('../placeholder/tv-placeholder-screen.component').then(
        (c) => c.TvPlaceholderScreenComponent
    );

const loadTvCatalogScreenComponent: ComponentLoader = () =>
    import('../catalog/tv-catalog-screen.component').then(
        (c) => c.TvCatalogScreenComponent
    );

/**
 * The `/tv` route subtree (§5.2). Mirrors the workspace's Xtream route
 * shape (`xtreams/:id/...`) so a future "open this item in the other shell"
 * mapping stays trivial.
 *
 * The source picker (`''`) is a Phase 2 screen; `movies`/`series` are Phase
 * 3a (§7.4, `TvCatalogScreenComponent`, driven by route `data.tvCatalogType`).
 * `home`/`live`/`search`/`detail` still render `TvPlaceholderScreenComponent`
 * until their owning phase replaces them — the routes exist now so
 * navigation and deep links resolve.
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
                    loadComponent: loadTvPlaceholderScreenComponent,
                },
                {
                    path: 'xtreams/:id/live',
                    data: { tvScreen: 'live' },
                    loadComponent: loadTvPlaceholderScreenComponent,
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
                    loadComponent: loadTvPlaceholderScreenComponent,
                },
                {
                    path: 'xtreams/:id/detail/:type/:itemId',
                    data: { tvScreen: 'detail' },
                    loadComponent: loadTvPlaceholderScreenComponent,
                },
            ],
        },
    ];
}
