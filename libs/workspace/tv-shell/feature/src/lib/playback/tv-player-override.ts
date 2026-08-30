import { VideoPlayer } from '@iptvnator/shared/interfaces';

/** Web-engine players: DOM-composited, so TV overlays always work unmodified. */
const WEB_ENGINE_PLAYERS: ReadonlySet<VideoPlayer> = new Set([
    VideoPlayer.Html5Player,
    VideoPlayer.VideoJs,
    VideoPlayer.ArtPlayer,
]);

/**
 * TV mode's playback engine override (§9.1 of the design doc). Embedded MPV
 * native-view composites a child window ABOVE the DOM — a TV UI built on
 * overlays drawn over video cannot use it. External MPV/VLC open a separate
 * OS window with no overlay surface and are not remote-driven. Both are
 * excluded the same way `isDashChannel()` already bypasses the
 * external-player setting for DASH channels
 * (`libs/shared/m3u-utils/src/lib/dash.utils.ts`): the desktop's chosen
 * player is forced onto a web engine in TV mode, unless Embedded MPV
 * frame-copy — which renders into a `<canvas>` and does support DOM
 * overlays — is enabled, in which case it is left alone.
 *
 * `TvPlaybackOverlayComponent` (Phase 4b) drives this with the genuine
 * result of a runtime frame-copy availability probe
 * (`isEmbeddedMpvFrameCopyAvailable`), never a settings flag — the second
 * parameter must always be that runtime fact, per §9.1b. `TvFrameCopyEngineComponent`
 * and `TvWebEngineComponent` consume `EmbeddedMpvPlayerComponent`/
 * `HtmlVideoPlayerComponent` through their own published inputs/outputs,
 * which §9.1a confirms is in bounds — §5.5 only forbids *modifying* those
 * components, not mounting them.
 */
export function resolveTvPlayerOverride(
    player: VideoPlayer | null | undefined,
    embeddedMpvFrameCopyAvailable: boolean
): VideoPlayer {
    if (player != null && WEB_ENGINE_PLAYERS.has(player)) {
        return player;
    }
    if (player === VideoPlayer.EmbeddedMpv && embeddedMpvFrameCopyAvailable) {
        return VideoPlayer.EmbeddedMpv;
    }
    return VideoPlayer.Html5Player;
}
