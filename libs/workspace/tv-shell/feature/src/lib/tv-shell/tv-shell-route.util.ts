/**
 * TV mode's root route (§5.2): `/tv/xtreams/:id/home`. Pure and DOM-free so
 * the shell's Back-at-root check is unit-testable without a Router.
 * Mirrors the pattern the E2E specs already match against
 * (`/\/tv\/xtreams\/.+\/home$/`) rather than inventing a second one.
 */
const TV_HOME_ROUTE_PATTERN = /\/tv\/xtreams\/[^/]+\/home(?:[/?#]|$)/;

export function isTvHomeRoute(url: string): boolean {
    return TV_HOME_ROUTE_PATTERN.test(url);
}
