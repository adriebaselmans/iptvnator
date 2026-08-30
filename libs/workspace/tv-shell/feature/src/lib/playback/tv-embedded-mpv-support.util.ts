import type { ElectronBridgeApi } from '@iptvnator/shared/interfaces';

/**
 * Frame-copy availability is a runtime fact — gated by the packaged
 * manifest, hash and a bounded runtime probe (see
 * `docs/architecture/embedded-mpv-native.md`), fail-closed, and x64-only on
 * Linux — never a setting to trust. This asks the exact same question
 * `EmbeddedMpvSessionController.loadSupport()` asks
 * (`window.electron.getEmbeddedMpvSupport()`) and the exact same way: guard
 * the method's existence first (PWA/older preload has none), then treat any
 * rejection as "not available" rather than letting it propagate — a failed
 * probe must fall through to the web engine, never crash or dead-end the
 * player (§9.1b).
 */
export async function isEmbeddedMpvFrameCopyAvailable(
    electron: Pick<ElectronBridgeApi, 'getEmbeddedMpvSupport'> | undefined
): Promise<boolean> {
    if (typeof electron?.getEmbeddedMpvSupport !== 'function') {
        return false;
    }
    try {
        const support = await electron.getEmbeddedMpvSupport();
        return support.supported === true && support.engine === 'frame-copy';
    } catch {
        return false;
    }
}
