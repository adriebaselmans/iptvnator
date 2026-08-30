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

/**
 * The `/tv` route subtree (§5.2). Mirrors the workspace's Xtream route
 * shape (`xtreams/:id/...`) so a future "open this item in the other shell"
 * mapping stays trivial.
 *
 * Only the source picker (`''`) is a real Phase 2 screen. Every
 * `xtreams/:id/*` screen renders `TvPlaceholderScreenComponent` until its
 * owning phase (see the file header of that component) replaces it — the
 * routes exist now so navigation and deep links resolve.
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
                    data: { tvScreen: 'movies' },
                    loadComponent: loadTvPlaceholderScreenComponent,
                },
                {
                    path: 'xtreams/:id/series',
                    data: { tvScreen: 'series' },
                    loadComponent: loadTvPlaceholderScreenComponent,
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
