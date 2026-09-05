import {
    applyTvKeyboardBackspace,
    applyTvKeyboardChar,
    buildTvAddSourcePlaylist,
    canAdvanceWizardStep,
    isNormalizableServerUrl,
    nextTvAddSourceWizardStep,
    previousTvAddSourceWizardStep,
} from './tv-add-source-wizard.util';

describe('tv-add-source-wizard.util', () => {
    it('appends and removes characters', () => {
        expect(applyTvKeyboardChar('ab', 'c')).toBe('abc');
        expect(applyTvKeyboardBackspace('abc')).toBe('ab');
        expect(applyTvKeyboardBackspace('')).toBe('');
    });

    it('validates server URLs the same way the desktop import dialog does', () => {
        expect(isNormalizableServerUrl('http://example.com')).toBe(true);
        expect(isNormalizableServerUrl('not a url')).toBe(false);
        expect(isNormalizableServerUrl('')).toBe(false);
        expect(isNormalizableServerUrl('   ')).toBe(false);
    });

    it('gates Next/Connect per step', () => {
        const values = { serverUrl: '', username: '', password: '' };
        expect(canAdvanceWizardStep('url', values)).toBe(false);
        expect(
            canAdvanceWizardStep('url', {
                ...values,
                serverUrl: 'http://example.com',
            })
        ).toBe(true);

        expect(canAdvanceWizardStep('username', values)).toBe(false);
        expect(
            canAdvanceWizardStep('username', { ...values, username: 'u' })
        ).toBe(true);

        expect(canAdvanceWizardStep('password', values)).toBe(false);
        expect(
            canAdvanceWizardStep('password', { ...values, password: 'p' })
        ).toBe(true);

        expect(canAdvanceWizardStep('idle', values)).toBe(false);
        expect(canAdvanceWizardStep('connecting', values)).toBe(false);
    });

    it('walks Next forward through url -> username -> password and stops there', () => {
        expect(nextTvAddSourceWizardStep('url')).toBe('username');
        expect(nextTvAddSourceWizardStep('username')).toBe('password');
        expect(nextTvAddSourceWizardStep('password')).toBe('password');
    });

    it('walks Back the other way, ending at idle (the source cards)', () => {
        expect(previousTvAddSourceWizardStep('password')).toBe('username');
        expect(previousTvAddSourceWizardStep('username')).toBe('url');
        expect(previousTvAddSourceWizardStep('url')).toBe('idle');
        expect(previousTvAddSourceWizardStep('idle')).toBe('idle');
    });

    it('builds a Playlist row from the wizard inputs, normalizing the URL and trimming credentials', () => {
        const playlist = buildTvAddSourcePlaylist({
            serverUrl: ' http://example.com:8080/player_api.php ',
            username: ' user ',
            password: ' pass ',
        });

        expect(playlist.serverUrl).toBe('http://example.com:8080');
        expect(playlist.username).toBe('user');
        expect(playlist.password).toBe('pass');
        expect(playlist.title).toBe('example.com:8080 (user)');
        expect(playlist._id).toEqual(expect.any(String));
        expect(playlist._id.length).toBeGreaterThan(0);
        expect(playlist.count).toBe(0);
        expect(playlist.autoRefresh).toBe(false);
    });

    it('throws when asked to build a playlist from an unnormalizable URL', () => {
        expect(() =>
            buildTvAddSourcePlaylist({
                serverUrl: 'not a url',
                username: 'user',
                password: 'pass',
            })
        ).toThrow();
    });
});
