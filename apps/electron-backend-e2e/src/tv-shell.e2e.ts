import { APIRequestContext, Page } from '@playwright/test';
import {
    addXtreamPortal,
    closeElectronApp,
    defaultXtreamPassword,
    defaultXtreamUsername,
    expect,
    launchElectronApp,
    resetMockServers,
    restartElectronApp,
    test,
    waitForXtreamCatalog,
    xtreamMockServer,
} from './electron-test-fixtures';

/**
 * Electron-path coverage for the TV shell (`/tv`).
 *
 * Every previous TV shell test — unit and both `apps/web-e2e` E2E specs
 * (`tv-catalog-scale.e2e.ts`, `tv-keyboard-only.e2e.ts`) — runs the web app,
 * which always resolves `provideXtreamDataSource()` to `PwaXtreamDataSource`
 * (API-only, raw Xtream API item shapes: `name`, `stream_id`/`series_id`,
 * `stream_icon`). None of them ever exercised `ElectronXtreamDataSource`
 * (SQLite, DB-first — `libs/shared/database/src/lib/schema.ts`'s `content`
 * table, whose rows carry `title`/`xtream_id`/`poster_url` instead), which is
 * what a packaged desktop build actually uses. This is the suite that would
 * have caught the resulting defects (blank live TV, blank movie/series
 * detail with only Favourite selectable) before a real user did.
 *
 * The portal is added once through the ordinary desktop workspace (TV mode
 * has no way to add a source from a six-key remote — `docs/architecture/tv-shell.md`
 * "Known limitations"), which also warms the SQLite `content` cache via the
 * normal import path. The app is then restarted with the `--tv` CLI flag
 * (`shouldStartInKioskMode` in `apps/electron-backend/src/app/app.ts`) against
 * the SAME data directory, so the TV shell boots straight into `/tv` and reads
 * that already-cached DB-backed content — exactly the path a packaged app
 * takes on a machine that already has a source configured.
 */

const TV_USERNAME = defaultXtreamUsername;
const TV_PASSWORD = defaultXtreamPassword;

test.describe('Electron TV Shell', () => {
    test('@tv live TV lists channels from the DB-backed data source', async ({
        dataDir,
        request,
    }) => {
        await resetMockServers(request, ['xtream']);
        const liveChannelName = await fetchFirstLiveChannelName(request);

        let app = await launchElectronApp(dataDir);
        try {
            await addXtreamPortal(app.mainWindow, {
                username: TV_USERNAME,
                password: TV_PASSWORD,
            });
            // Warms the SQLite `content` cache (ElectronXtreamDataSource is
            // DB-first) before the TV shell ever reads it.
            await waitForXtreamCatalog(app.mainWindow);

            app = await restartElectronApp(app, dataDir, {
                appArgs: ['--tv'],
            });

            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/home$/, {
                timeout: 30000,
            });
            await expect(
                app.mainWindow.locator('.tv-home-screen')
            ).toBeVisible();

            await navBarItem(app.mainWindow, 'Live').click();
            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/live$/, {
                timeout: 20000,
            });

            // The defect this regresses: `toTvLiveChannel` (before the fix)
            // read only `item.name`, which the DB row shape never carries
            // (it has `title` instead) — every row failed validation and was
            // dropped, so the screen fell through to the empty-state
            // placeholder instead of ever mounting playback. Wait for
            // playback to mount first (proves `channels()` is non-empty),
            // then confirm the empty-state placeholder never rendered.
            await expect(
                app.mainWindow.locator('.tv-playback-overlay')
            ).toBeVisible({ timeout: 20000 });
            await expect(
                app.mainWindow.locator('.tv-catalog-state')
            ).toHaveCount(0);

            // Opens the channel bar (Enter, per `mapTvPlaybackKeyToIntent`'s
            // live mapping) and asserts it actually lists real channels
            // rather than being empty too.
            await app.mainWindow.keyboard.press('Enter');
            const channelItems = app.mainWindow.locator(
                '.tv-channel-bar__item'
            );
            await expect(channelItems.first()).toBeVisible({
                timeout: 20000,
            });
            await expect(
                app.mainWindow.locator('.tv-channel-bar__name').first()
            ).not.toHaveText('');
            await expect(
                app.mainWindow.locator('.tv-channel-bar').first()
            ).toContainText(liveChannelName, { timeout: 20000 });
        } finally {
            await closeElectronApp(app);
        }
    });

    test('@tv a movie detail resolves a playable source from the DB-backed data source', async ({
        dataDir,
        request,
    }) => {
        await resetMockServers(request, ['xtream']);

        let app = await launchElectronApp(dataDir);
        try {
            await addXtreamPortal(app.mainWindow, {
                username: TV_USERNAME,
                password: TV_PASSWORD,
            });
            await waitForXtreamCatalog(app.mainWindow);

            app = await restartElectronApp(app, dataDir, {
                appArgs: ['--tv'],
            });

            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/home$/, {
                timeout: 30000,
            });

            await navBarItem(app.mainWindow, 'Movies').click();
            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/movies$/, {
                timeout: 20000,
            });

            const grid = app.mainWindow.locator('.tv-poster-grid');
            await expect(grid).toBeVisible();
            const firstCard = app.mainWindow.locator('.tv-poster-card').first();
            await expect(firstCard).toBeVisible({ timeout: 20000 });
            const posterTitle = (
                await app.mainWindow
                    .locator('.tv-poster-card__title')
                    .first()
                    .textContent()
            )?.trim();
            expect(posterTitle).toBeTruthy();

            await firstCard.click();
            await app.mainWindow.waitForURL(
                /\/tv\/xtreams\/.+\/detail\/movie\/.+/,
                { timeout: 20000 }
            );

            // The defect this regresses: `resolveTvCatalogItemId` (before the
            // fix) fell through `stream_id ?? series_id ?? id` straight to
            // the DB row's SQLite primary key `id` — the wrong id space
            // entirely for `get_vod_info`/`get_series_info`. The provider
            // rejected it, `resolveTvMovieItem`'s identity guard then
            // rejected the mismatched response, and the hero rendered with
            // an empty fallback title and no playable source — only the
            // id-independent Favourite action stayed enabled.
            const heroTitle = app.mainWindow.locator('.tv-detail-hero__title');
            await expect(heroTitle).toBeVisible({ timeout: 20000 });
            await expect(heroTitle).not.toHaveText('');
            if (posterTitle) {
                await expect(heroTitle).toContainText(posterTitle, {
                    timeout: 20000,
                });
            }

            const playButton = app.mainWindow.locator(
                '.tv-detail-action-row__button--primary'
            );
            await expect(playButton).toBeVisible({ timeout: 20000 });

            await playButton.click();
            await expect(
                app.mainWindow.locator('.tv-playback-overlay')
            ).toBeVisible({ timeout: 20000 });

            // The overlay mounting is not proof of playback — it is proof a
            // player component was instantiated. Assert the underlying
            // <video> element actually decodes and advances, not merely that
            // it exists with a src.
            const video = app.mainWindow.locator(
                '.tv-playback-overlay video'
            );
            await expect(video).toBeVisible({ timeout: 20000 });
            await expect
                .poll(
                    async () =>
                        video.evaluate(
                            (el: HTMLVideoElement) => el.readyState
                        ),
                    { timeout: 20000, message: 'video never reached HAVE_CURRENT_DATA' }
                )
                .toBeGreaterThanOrEqual(2);
            const timeBefore = await video.evaluate(
                (el: HTMLVideoElement) => el.currentTime
            );
            await app.mainWindow.waitForTimeout(3000);
            const timeAfter = await video.evaluate(
                (el: HTMLVideoElement) => el.currentTime
            );
            expect(
                timeAfter,
                'currentTime did not advance — video is not actually playing'
            ).toBeGreaterThan(timeBefore);
        } finally {
            await closeElectronApp(app);
        }
    });

    test('@tv a broken stream shows a keyboard-reachable Retry', async ({
        dataDir,
        request,
    }) => {
        await resetMockServers(request, ['xtream']);

        let app = await launchElectronApp(dataDir);
        try {
            await addXtreamPortal(app.mainWindow, {
                username: TV_USERNAME,
                password: TV_PASSWORD,
            });
            await waitForXtreamCatalog(app.mainWindow);

            app = await restartElectronApp(app, dataDir, {
                appArgs: ['--tv'],
            });
            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/home$/, {
                timeout: 30000,
            });

            // Simulate a real provider being unreachable: abort the stream
            // request at the network level rather than relying on the mock
            // server ever returning an error for it.
            await app.mainWindow.route('**/movie/**', (route) =>
                route.abort('connectionrefused')
            );
            await app.mainWindow.route('**/x36xhzz*', (route) =>
                route.abort('connectionrefused')
            );

            await navBarItem(app.mainWindow, 'Movies').click();
            await app.mainWindow.waitForURL(/\/tv\/xtreams\/.+\/movies$/, {
                timeout: 20000,
            });
            const firstCard = app.mainWindow
                .locator('.tv-poster-card')
                .first();
            await expect(firstCard).toBeVisible({ timeout: 20000 });
            await firstCard.click();
            await app.mainWindow.waitForURL(
                /\/tv\/xtreams\/.+\/detail\/movie\/.+/,
                { timeout: 20000 }
            );
            const playButton = app.mainWindow.locator(
                '.tv-detail-action-row__button--primary'
            );
            await expect(playButton).toBeVisible({ timeout: 20000 });
            await playButton.click();

            // The defect this regresses: `TvWebEngineComponent` rendered
            // `<lib-tv-catalog-state variant="error">` with its own Retry
            // button on a genuine playback failure, but nothing ever called
            // `TvFocusService.setActive()` for its focus group — the group
            // registered itself but was never made active, so real DOM
            // focus (and `TvFocusService.activeElement()`) stayed on
            // whatever the detail page had focused before playback started
            // (its own Play button). The error state was visible but
            // completely unreachable from a remote: OK did nothing, and a
            // second OK press would have silently replayed the same broken
            // stream instead of retrying through the visible button (§6.4
            // "no hidden actions" — a rendered-but-unfocusable control is
            // worse than not rendering one at all).
            const retryButton = app.mainWindow.locator(
                '.tv-catalog-state__retry'
            );
            await expect(retryButton).toBeVisible({ timeout: 20000 });
            await expect(retryButton).toHaveClass(/tv-focused/, {
                timeout: 20000,
            });

            let retryRequestSeen = false;
            app.mainWindow.on('request', (req) => {
                if (req.url().includes('/movie/')) retryRequestSeen = true;
            });
            await app.mainWindow.keyboard.press('Enter');
            await expect
                .poll(() => retryRequestSeen, {
                    timeout: 10000,
                    message:
                        'Enter on the focused Retry did not re-request the stream',
                })
                .toBe(true);
        } finally {
            await closeElectronApp(app);
        }
    });
});

function navBarItem(page: Page, label: string) {
    return page.locator('.tv-nav-bar__item').filter({ hasText: label });
}

async function fetchFirstLiveChannelName(
    request: APIRequestContext
): Promise<string> {
    const response = await request.get(`${xtreamMockServer}/player_api.php`, {
        params: {
            action: 'get_live_streams',
            username: TV_USERNAME,
            password: TV_PASSWORD,
        },
    });
    expect(response.ok()).toBeTruthy();
    const streams = (await response.json()) as Array<{ name: string }>;
    const first = streams[0];
    if (!first?.name) {
        throw new Error('Xtream mock server returned no live streams.');
    }
    return first.name;
}
