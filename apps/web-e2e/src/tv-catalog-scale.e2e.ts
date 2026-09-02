import { expect, test } from './fixtures';
import {
    addXtreamPortal,
    interceptXtreamRequests,
    MOCK_SERVER,
} from './tv-e2e-helpers';

/**
 * TV shell catalogue-scale E2E (design doc §4, §8.2, §11).
 *
 * The quality attribute under test: "40,000 VOD titles browsable; DOM never
 * holds more than the loaded window." `TvPosterGridComponent` renders exactly
 * `XtreamStore.getPaginatedContent()` — the store's `visibleCount` render
 * window — and grows it by `CATALOG_WINDOW_CHUNK` (50) each time focus
 * reaches the grid's last loaded row (§8.2). This test seeds the mock server
 * with the `tvscale:tvscale` scenario (40,000 VOD titles in one category, no
 * live/series generation — see `apps/xtream-mock-server/src/app/scenarios.ts`)
 * and pages deep into it via keyboard-driven `loadMore` triggers, asserting
 * the rendered card count stays a small, bounded multiple of the initial
 * window rather than approaching the full catalogue.
 *
 * Paging to the LITERAL last item (chunk 799 of 800) is not attempted: at 50
 * items per chunk that is ~800 focus-driven grid descents, which buys no
 * additional proof over paging deep enough to show the window growing in
 * bounded 50-item steps while the catalogue behind it stays at 40,000. The
 * assertion is about boundedness, not exhaustion.
 */

const TV_SCALE_USERNAME = 'tvscale';
const TV_SCALE_PASSWORD = 'tvscale';
const TV_SCALE_TOTAL_VOD_ITEMS = 40_000;
const INITIAL_WINDOW = 50;
/** How many focus-driven `loadMore` triggers to page through before asserting. */
const LOAD_MORE_TRIGGERS = 20;
/**
 * Generous upper bound on rendered cards after `LOAD_MORE_TRIGGERS` chunks.
 * Real growth is `INITIAL_WINDOW + LOAD_MORE_TRIGGERS * 50` (~1,050); this
 * ceiling only needs to sit far below the full catalogue to prove the DOM
 * never renders it in full.
 */
const BOUNDED_CARD_CEILING = 3_000;

test.beforeEach(async ({ page, request }) => {
    await request.post(`${MOCK_SERVER}/reset`);
    await page.goto('/');
    await interceptXtreamRequests(page);
});

test('@tv paging deep into a 40,000-title catalogue keeps the rendered card count bounded', async ({
    page,
    request,
}, testInfo) => {
    // `LOAD_MORE_TRIGGERS` (20) descents, each needing up to
    // `ceil(previousCount / 2) + 1` real `ArrowDown` key presses against a
    // window that grows by 50 every trigger, add up to several thousand
    // individual `page.keyboard.press()` round-trips by the last iteration —
    // comfortably past Playwright's 30s default budget once focus genuinely
    // moves through the grid (same reasoning as `stalker.e2e.ts`'s full-auth
    // suite).
    testInfo.setTimeout(120_000);

    // Sanity-check the seeded fixture size against the mock server directly,
    // independent of anything the app renders.
    const vodResponse = await request.get(`${MOCK_SERVER}/xtream`, {
        params: {
            username: TV_SCALE_USERNAME,
            password: TV_SCALE_PASSWORD,
            action: 'get_vod_streams',
        },
    });
    expect(vodResponse.ok()).toBe(true);
    // The `/xtream` route mirrors the app's own CORS-proxy shape
    // (`dispatchProxyAction` in the mock server) — the array sits under
    // `.payload`, exactly like `xtream.e2e.ts` already reads it.
    const vodBody = (await vodResponse.json()) as { payload: unknown[] };
    expect(vodBody.payload.length).toBe(TV_SCALE_TOTAL_VOD_ITEMS);

    await addXtreamPortal(page, {
        name: 'TV Scale Portal',
        username: TV_SCALE_USERNAME,
        password: TV_SCALE_PASSWORD,
    });

    await page.goto('/tv');
    await page.waitForURL(/\/tv\/xtreams\/.+\/home/);

    const currentUrl = new URL(page.url());
    const moviesUrl = currentUrl.pathname.replace(/\/home$/, '/movies');
    await page.goto(moviesUrl);

    const grid = page.locator('.tv-poster-grid');
    await expect(grid).toBeVisible();

    const cards = page.locator('.tv-poster-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(INITIAL_WINDOW);

    // Enter the grid focus group from the category rail (§7.4 neighbours:
    // rail `down` -> grid), then keep moving down. Down moves one row at a
    // time (`computeGridMove`'s `+columnCount` arithmetic), and
    // `TvPosterGridComponent` triggers `loadMore` whenever the active index
    // sits in the grid's last currently-rendered row (§8.2) — so this is
    // exactly the focus-driven mechanism the design specifies, not a
    // scroll-position substitute for it.
    await page.keyboard.press('ArrowDown');

    let previousCount = INITIAL_WINDOW;
    for (let trigger = 0; trigger < LOAD_MORE_TRIGGERS; trigger += 1) {
        // Press one row at a time and stop the instant the window grows,
        // rather than pre-computing a fixed batch size. A fixed batch sized
        // for the narrowest supported column count
        // (`TV_GRID_MIN_COLUMNS` = 2) is only a valid upper bound on how many
        // presses are NEEDED to reach the last row — at the real runtime
        // column count (measured from the viewport, §7.4 — 3+ at a normal
        // desktop width, never exactly the assumed worst case), the same
        // fixed batch reaches the bottom sooner and then keeps going,
        // legitimately walking through several new "last row" arrivals
        // within one batch and growing the window by several chunks instead
        // of one. `TvPosterGridComponent` firing on every genuine arrival is
        // correct (§8.2); the fixed-size batch was the wrong model of it.
        // `maxPressesForThisWindow` remains a safety cap so a genuine
        // regression (loadMore never firing) still fails fast instead of
        // hanging.
        const maxPressesForThisWindow = Math.ceil(previousCount / 2) + 1;
        let grown = false;
        for (let press = 0; press < maxPressesForThisWindow; press += 1) {
            await page.keyboard.press('ArrowDown');
            if ((await cards.count()) > previousCount) {
                grown = true;
                break;
            }
        }
        expect(grown).toBe(true);
        previousCount = await cards.count();

        // Bounded at every step, not just at the end — a virtualization
        // regression that renders the whole catalogue at once would fail
        // this immediately rather than only on the final assertion.
        expect(previousCount).toBeLessThan(BOUNDED_CARD_CEILING);
    }

    expect(previousCount).toBeGreaterThan(INITIAL_WINDOW);
    expect(previousCount).toBeLessThan(BOUNDED_CARD_CEILING);
    expect(previousCount).toBeLessThan(TV_SCALE_TOTAL_VOD_ITEMS / 10);
});
