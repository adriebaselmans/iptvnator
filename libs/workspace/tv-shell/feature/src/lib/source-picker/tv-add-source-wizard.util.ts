import {
    createRandomId,
    normalizeXtreamServerUrl,
    Playlist,
} from '@iptvnator/shared/interfaces';

/**
 * The TV source picker's inline "Add Xtream source" wizard (§7.1 follow-up):
 * three on-screen-keyboard steps collected in the picker component itself —
 * no new route, so these are plain state-machine/data helpers the component
 * wires up rather than a second component.
 */
export type TvAddSourceWizardStep =
    | 'idle'
    | 'url'
    | 'username'
    | 'password'
    | 'connecting';

/** Backspace drops the last character; anything else appends verbatim. */
export function applyTvKeyboardChar(current: string, char: string): string {
    return current + char;
}

export function applyTvKeyboardBackspace(current: string): string {
    return current.slice(0, -1);
}

/**
 * Whether the wizard's Next/Connect action may fire for the given step. The
 * URL step additionally requires a normalizable Xtream server URL — a typo
 * there should never reach a network request the picker cannot explain.
 */
export function canAdvanceWizardStep(
    step: TvAddSourceWizardStep,
    values: { serverUrl: string; username: string; password: string }
): boolean {
    switch (step) {
        case 'url':
            return isNormalizableServerUrl(values.serverUrl);
        case 'username':
            return values.username.trim().length > 0;
        case 'password':
            return values.password.trim().length > 0;
        default:
            return false;
    }
}

export function isNormalizableServerUrl(value: string): boolean {
    if (value.trim().length === 0) {
        return false;
    }
    try {
        normalizeXtreamServerUrl(value);
        return true;
    } catch {
        return false;
    }
}

/** `url -> username -> password`; Connect (on `password`) is handled by the caller. */
export function nextTvAddSourceWizardStep(
    step: TvAddSourceWizardStep
): TvAddSourceWizardStep {
    switch (step) {
        case 'url':
            return 'username';
        case 'username':
            return 'password';
        default:
            return step;
    }
}

/** `password -> username -> url -> idle` (back to the source cards). */
export function previousTvAddSourceWizardStep(
    step: TvAddSourceWizardStep
): TvAddSourceWizardStep {
    switch (step) {
        case 'password':
            return 'username';
        case 'username':
            return 'url';
        default:
            return 'idle';
    }
}

/**
 * Builds the `Playlist` row the same way the desktop Xtream import dialog
 * does (`XtreamCodeImportComponent.addPlaylist()`), minus the title field
 * the TV wizard never collects — derived here from the server host instead,
 * since `Playlist.title` is required and a wizard step for it would be a
 * fourth on-screen-keyboard screen for a cosmetic label.
 */
export function buildTvAddSourcePlaylist(values: {
    serverUrl: string;
    username: string;
    password: string;
}): Playlist {
    const serverUrl = normalizeXtreamServerUrl(values.serverUrl);
    const username = values.username.trim();
    const password = values.password.trim();

    return {
        _id: createRandomId(),
        title: titleFromServerUrl(serverUrl, username),
        importDate: new Date().toISOString(),
        lastUsage: '',
        count: 0,
        autoRefresh: false,
        serverUrl,
        username,
        password,
    };
}

function titleFromServerUrl(serverUrl: string, username: string): string {
    try {
        return `${new URL(serverUrl).host} (${username})`;
    } catch {
        return username;
    }
}
