import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { setInputValue } from './e2e-helpers';
import {
    getRegisteredProviderUrl,
    interceptProviderTargetRegistration,
} from './provider-target-route';

/**
 * Shared setup for the TV shell E2E specs (`tv-catalog-scale.e2e.ts`,
 * `tv-keyboard-only.e2e.ts`). Mirrors the interception/import pattern
 * `xtream.e2e.ts` already uses against `xtream-mock-server`, factored out so
 * both TV specs share one copy instead of duplicating it.
 */

export const XTREAM_MOCK_PORT = process.env['XTREAM_MOCK_PORT'] ?? '3211';
export const MOCK_SERVER = `http://localhost:${XTREAM_MOCK_PORT}`;

/** Intercept calls from the Angular PWA proxy (`/xtream`) and redirect them to the mock server. */
export async function interceptXtreamRequests(page: Page): Promise<void> {
    const providerTargets = await interceptProviderTargetRegistration(page);

    await page.route('**/localhost:3000/xtream**', async (route) => {
        const originalUrl = new URL(route.request().url());
        const mockUrl = new URL(`${MOCK_SERVER}/xtream`);
        const providerUrl = getRegisteredProviderUrl(
            originalUrl,
            providerTargets
        );

        if (providerUrl) {
            mockUrl.searchParams.set('url', providerUrl);
        }

        originalUrl.searchParams.forEach((value, key) => {
            if (key === 'targetId') {
                return;
            }
            mockUrl.searchParams.set(key, value);
        });
        await route.continue({ url: mockUrl.toString() });
    });
}

/**
 * Adds an Xtream portal through the desktop "Add playlist" dialog.
 *
 * This is fixture setup, not part of the TV shell itself: TV mode has no way
 * to add a source from the remote (§3 non-goals — "not multi-portal in v1"
 * and the six-key vocabulary has no text entry), so a real HTPC owner adds
 * sources from the desktop UI or CLI first, then switches to `/tv`. The
 * clicks here are deliberately outside the keyboard-only assertion boundary
 * of `tv-keyboard-only.e2e.ts`, which starts only once the test navigates to
 * `/tv`.
 */
export async function addXtreamPortal(
    page: Page,
    options: { name?: string; username: string; password: string }
): Promise<void> {
    const { name = 'Mock Xtream Portal', username, password } = options;

    await page.getByRole('button', { name: 'Add playlist' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: /Xtream credentials/i }).click();

    await setInputValue(dialog.locator('#title'), name);
    await setInputValue(dialog.locator('#serverUrl'), MOCK_SERVER);
    await setInputValue(dialog.locator('#username'), username);
    await setInputValue(dialog.locator('#password'), password);

    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForSelector('mat-dialog-container', { state: 'detached' });
    await page.waitForURL(/xtreams.*vod/);
}

/**
 * Picks a short, deterministic lowercase alphanumeric substring out of a
 * generated title for use as a search query on the on-screen keyboard, which
 * only has digits, letters and space (`buildTvKeyboardKeys()`). Generated
 * titles interleave a faker song name with punctuation (`Title: two words`),
 * so this returns the first run of `[a-z0-9]` at least
 * `TV_SEARCH_MIN_QUERY_LENGTH` (3) characters long.
 */
export function extractSearchableSubstring(title: string): string {
    const match = title.toLowerCase().match(/[a-z0-9]{3,}/);
    if (!match) {
        throw new Error(
            `No searchable substring found in generated title: ${title}`
        );
    }
    return match[0].slice(0, 4);
}
