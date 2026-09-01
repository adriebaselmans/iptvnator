import { expect, test } from './fixtures';
import {
    addXtreamPortal,
    extractSearchableSubstring,
    interceptXtreamRequests,
    MOCK_SERVER,
} from './tv-e2e-helpers';

/**
 * The TV shell's keyboard-only journey (design doc §11: "Full journeys
 * driven ONLY by keyboard events... any `click()` in these specs is a bug,
 * because it proves nothing about remote operability").
 *
 * `.click()` appears exactly once below, inside `addXtreamPortal()` from
 * `tv-e2e-helpers.ts` — adding a playlist is desktop-workspace setup, not
 * part of the TV shell (§3 non-goals: TV mode has no way to add a source
 * from a six-key remote). The assertion boundary for "keyboard only" starts
 * at the first `page.goto('/tv')` below; every interaction after that point
 * is `page.keyboard.press(...)`.
 *
 * Two navigation hops (`home -> movies`, `-> search`) use `page.goto()`
 * rather than an in-app keyboard action. That is not a stylistic choice: the
 * TV shell has NO in-app navigation from the home screen to the movies,
 * series or search screens — no persistent nav, and no home rail routes
 * there (home rails only link to detail pages and live). A real remote
 * user could not reach those screens at all except by URL, which a six-key
 * remote cannot type. This is a genuine gap in remote coverage (design §4:
 * "100% of interactive elements reachable with arrows/OK/Back"), found
 * while writing this spec and reported rather than fixed here (Phase 7 may
 * not change TV shell behaviour) — see the Phase 7 report and
 * `docs/architecture/tv-shell.md`'s "Known limitations".
 *
 * The multi-source source-picker screen is also not exercised here: this
 * test uses exactly one Xtream source, which the picker auto-redirects past
 * (§7.1 — a legitimate, zero-input keyboard-operable path). A second,
 * separately discovered defect makes the picker screen itself unusable from
 * a remote when there IS more than one source: `TvSourcePickerComponent`
 * never calls `TvFocusService.setActive()`, so nothing is ever focused and
 * neither arrow keys nor OK do anything on that screen. Also reported, not
 * fixed here.
 */

const USERNAME = 'user1';
const PASSWORD = 'pass1';

test.beforeEach(async ({ page, request }) => {
    await request.post(`${MOCK_SERVER}/reset`);
    await page.goto('/');
    await interceptXtreamRequests(page);
});

test('@tv source pick, browse, search, detail, play, back — keyboard only', async ({
    page,
    request,
}) => {
    const vodResponse = await request.get(`${MOCK_SERVER}/xtream`, {
        params: { username: USERNAME, password: PASSWORD, action: 'get_vod_streams' },
    });
    expect(vodResponse.ok()).toBe(true);
    const vodStreams = (await vodResponse.json()) as Array<{ name: string }>;
    const searchQuery = extractSearchableSubstring(vodStreams[0].name);

    // --- Setup (not part of the keyboard-only assertion — see file docblock) ---
    await addXtreamPortal(page, { username: USERNAME, password: PASSWORD });

    // --- Source pick (single source: auto-redirect, zero input required) ---
    await page.goto('/tv');
    await page.waitForURL(/\/tv\/xtreams\/.+\/home/);
    await expect(page.locator('.tv-home-screen')).toBeVisible();

    const homeUrl = new URL(page.url());

    // --- Browse (home -> movies is a URL hop; see file docblock) ---
    await page.goto(homeUrl.pathname.replace(/\/home$/, '/movies'));
    const grid = page.locator('.tv-poster-grid');
    await expect(grid).toBeVisible();
    const cards = page.locator('.tv-poster-card');
    await expect(cards.first()).toBeVisible();

    // Rail is focused first (§7.4 initial focus); Down enters the grid.
    await page.keyboard.press('ArrowDown');
    await expect(cards.first()).toHaveClass(/tv-focused/);
    await page.keyboard.press('Enter');

    // --- Detail ---
    await page.waitForURL(/\/tv\/xtreams\/.+\/detail\/movie\/.+/);
    const detailTitle = page.locator('.tv-detail-hero__title');
    await expect(detailTitle).toBeVisible();

    // --- Play ---
    const playButton = page.locator(
        '.tv-detail-action-row__button--primary'
    );
    await expect(playButton).toBeVisible();
    await expect(playButton).toHaveClass(/tv-focused/);
    await page.keyboard.press('Enter');
    await expect(page.locator('.tv-playback-overlay')).toBeVisible();

    // --- Back (exits playback, then pops navigation) ---
    await page.keyboard.press('Escape');
    await expect(page.locator('.tv-playback-overlay')).toHaveCount(0);
    await page.keyboard.press('Backspace');
    await page.waitForURL(/\/tv\/xtreams\/.+\/movies/);

    // --- Search (movies -> search is a URL hop; see file docblock) ---
    const moviesUrl = new URL(page.url());
    await page.goto(moviesUrl.pathname.replace(/\/movies$/, '/search'));
    const keyboardGroup = page.locator('.tv-keyboard__keys');
    await expect(keyboardGroup).toBeVisible();

    await typeOnTvKeyboard(page, searchQuery);

    const resultCards = page.locator('.tv-poster-card');
    await expect
        .poll(async () => resultCards.count(), { timeout: 5_000 })
        .toBeGreaterThan(0);

    // `typeOnTvKeyboard` leaves focus at column 0 of the keyboard's last
    // row, so this Down is the one that actually exits the keyboard group
    // (§6.2 grid geometry: Down only reports an exit from the last row) and
    // crosses into the results grid. Column 0 is preserved as the entry
    // column (`resolveGroupExit`'s cross-position), landing on the first
    // result.
    await page.keyboard.press('ArrowDown');
    await expect(resultCards.first()).toHaveClass(/tv-focused/);
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/tv\/xtreams\/.+\/detail\/(movie|series)\/.+/);
    await expect(detailTitle).toBeVisible();
    await expect(detailTitle).toContainText(new RegExp(searchQuery, 'i'));

    await page.keyboard.press('Backspace');
    await page.waitForURL(/\/tv\/xtreams\/.+\/search/);
});

/**
 * Types `text` on the TV shell's on-screen keyboard using only arrow/Enter
 * key presses, per the fixed 10-column layout `buildTvKeyboardKeys()`
 * defines: digits `0-9` at index 0-9, letters `a-z` at index 10-35 (both
 * row-major over 10 columns). Deterministic index arithmetic
 * (`computeGridMove`) makes a left-then-vertical-then-right path safe for
 * any character pair: column 0 exists in every row, including the ragged
 * last row, so routing through it avoids the one clamp case
 * (`computeGridDown`'s partial-last-row landing) that a direct diagonal path
 * could hit. Leaves focus in column 0 of whichever row the last character
 * sits in, which the caller relies on when crossing into the results grid.
 */
async function typeOnTvKeyboard(page: import('@playwright/test').Page, text: string): Promise<void> {
    const columnCount = 10;
    let currentIndex = 0; // Initial focus is the keyboard's first key (§7.6).

    for (const char of text.toLowerCase()) {
        const targetIndex = keyboardKeyIndex(char);
        const fromCol = currentIndex % columnCount;
        const fromRow = Math.floor(currentIndex / columnCount);
        const toCol = targetIndex % columnCount;
        const toRow = Math.floor(targetIndex / columnCount);

        for (let i = 0; i < fromCol; i += 1) {
            await page.keyboard.press('ArrowLeft');
        }
        const rowDiff = toRow - fromRow;
        for (let i = 0; i < Math.abs(rowDiff); i += 1) {
            await page.keyboard.press(rowDiff > 0 ? 'ArrowDown' : 'ArrowUp');
        }
        for (let i = 0; i < toCol; i += 1) {
            await page.keyboard.press('ArrowRight');
        }

        await page.keyboard.press('Enter');
        currentIndex = targetIndex;
    }

    // Return to column 0, then descend to the keyboard's last row (row 3).
    // `computeGridDown` only reports a group EXIT once the current row is
    // the last one — from any earlier row, Down just moves within the
    // keyboard grid — so the caller's next Down (to cross into the results
    // grid) only works from here. Column 0 is exact in every row, including
    // the ragged last one, so this is a safe fixed landing spot regardless
    // of which character was typed last.
    const finalCol = currentIndex % columnCount;
    for (let i = 0; i < finalCol; i += 1) {
        await page.keyboard.press('ArrowLeft');
    }
    const finalRow = Math.floor(currentIndex / columnCount);
    for (let i = finalRow; i < KEYBOARD_LAST_ROW; i += 1) {
        await page.keyboard.press('ArrowDown');
    }
}

/** `buildTvKeyboardKeys()`: 39 keys over 10 columns is 4 rows (10/10/10/9), 0-indexed. */
const KEYBOARD_LAST_ROW = 3;

function keyboardKeyIndex(char: string): number {
    if (char >= '0' && char <= '9') {
        return char.charCodeAt(0) - '0'.charCodeAt(0);
    }
    if (char >= 'a' && char <= 'z') {
        return 10 + (char.charCodeAt(0) - 'a'.charCodeAt(0));
    }
    throw new Error(`Unsupported TV keyboard character: ${char}`);
}
