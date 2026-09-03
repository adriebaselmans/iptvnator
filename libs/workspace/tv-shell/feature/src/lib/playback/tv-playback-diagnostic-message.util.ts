import {
    type PlaybackDiagnostic,
    PlaybackDiagnosticCode,
} from '@iptvnator/playback/util';

/**
 * Maps a `PlaybackDiagnostic.code` to a TV-native, translated description
 * key. `PlaybackDiagnostic` carries stable evidence codes, not prose (see
 * `libs/playback/util/src/lib/diagnostics/playback-diagnostics.model.ts`),
 * so something has to turn a code into user-facing copy. The desktop web
 * player already does this in
 * `libs/ui/playback/src/lib/playback-diagnostic-panel/playback-diagnostic-view.util.ts`,
 * but that helper is not exported from `@iptvnator/ui/playback`'s public
 * barrel and its sibling component branches on desktop-only external-player
 * capability that TV mode does not have (§9.1 excludes MPV/VLC recovery from
 * TV). This is a small, TV-shell-owned copy of just the code→copy mapping.
 */
export function tvPlaybackDiagnosticDescriptionKey(
    diagnostic: PlaybackDiagnostic
): string {
    switch (diagnostic.code) {
        case PlaybackDiagnosticCode.UnsupportedContainer:
            return 'TV.PLAYBACK.ERROR_UNSUPPORTED_CONTAINER';
        case PlaybackDiagnosticCode.UnsupportedCodec:
            return 'TV.PLAYBACK.ERROR_UNSUPPORTED_CODEC';
        case PlaybackDiagnosticCode.MediaDecodeError:
            return 'TV.PLAYBACK.ERROR_MEDIA_DECODE_ERROR';
        case PlaybackDiagnosticCode.NetworkError:
            return 'TV.PLAYBACK.ERROR_NETWORK_ERROR';
        case PlaybackDiagnosticCode.BrowserAccessError:
            return 'TV.PLAYBACK.ERROR_BROWSER_ACCESS_ERROR';
        case PlaybackDiagnosticCode.DrmOrEncryption:
            return 'TV.PLAYBACK.ERROR_DRM_OR_ENCRYPTION';
        case PlaybackDiagnosticCode.UnknownPlaybackError:
        default:
            return 'TV.PLAYBACK.ERROR_UNKNOWN_PLAYBACK_ERROR';
    }
}
