import {
    PlaybackDiagnosticCode,
    PlaybackDiagnosticSource,
    type PlaybackDiagnostic,
} from '@iptvnator/playback/util';
import { tvPlaybackDiagnosticDescriptionKey } from './tv-playback-diagnostic-message.util';

function diagnosticWith(code: PlaybackDiagnosticCode): PlaybackDiagnostic {
    return {
        code,
        source: PlaybackDiagnosticSource.Native,
        sourceUrl: 'http://host/stream.m3u8',
        container: 'mp4',
        audioCodecs: [],
        videoCodecs: [],
    };
}

describe('tvPlaybackDiagnosticDescriptionKey', () => {
    it.each([
        [
            PlaybackDiagnosticCode.UnsupportedContainer,
            'TV.PLAYBACK.ERROR_UNSUPPORTED_CONTAINER',
        ],
        [
            PlaybackDiagnosticCode.UnsupportedCodec,
            'TV.PLAYBACK.ERROR_UNSUPPORTED_CODEC',
        ],
        [
            PlaybackDiagnosticCode.MediaDecodeError,
            'TV.PLAYBACK.ERROR_MEDIA_DECODE_ERROR',
        ],
        [PlaybackDiagnosticCode.NetworkError, 'TV.PLAYBACK.ERROR_NETWORK_ERROR'],
        [
            PlaybackDiagnosticCode.BrowserAccessError,
            'TV.PLAYBACK.ERROR_BROWSER_ACCESS_ERROR',
        ],
        [
            PlaybackDiagnosticCode.DrmOrEncryption,
            'TV.PLAYBACK.ERROR_DRM_OR_ENCRYPTION',
        ],
        [
            PlaybackDiagnosticCode.UnknownPlaybackError,
            'TV.PLAYBACK.ERROR_UNKNOWN_PLAYBACK_ERROR',
        ],
    ])('maps %s to %s', (code, expectedKey) => {
        expect(tvPlaybackDiagnosticDescriptionKey(diagnosticWith(code))).toBe(
            expectedKey
        );
    });

    it('falls back to the unknown-error key for an unrecognized code', () => {
        const diagnostic = {
            ...diagnosticWith(PlaybackDiagnosticCode.UnknownPlaybackError),
            code: 'something-new' as PlaybackDiagnosticCode,
        };

        expect(tvPlaybackDiagnosticDescriptionKey(diagnostic)).toBe(
            'TV.PLAYBACK.ERROR_UNKNOWN_PLAYBACK_ERROR'
        );
    });
});
