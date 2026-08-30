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
 * `TvPlaybackOverlayComponent` does not implement an Embedded MPV frame-copy
 * renderer in this phase: that host lives under `libs/ui/playback` and
 * consuming it directly (rather than through the `PlayerController`
 * contract) would be reaching into player internals, which §5.5 puts out of
 * the shell's reach. This function documents and tests the policy so a
 * later phase can wire the frame-copy branch without re-deriving the rule —
 * see the Phase 4 report for this gap.
 */
export function resolveTvPlayerOverride(
    player: VideoPlayer | null | undefined,
    embeddedMpvFrameCopyEnabled: boolean
): VideoPlayer {
    if (player != null && WEB_ENGINE_PLAYERS.has(player)) {
        return player;
    }
    if (player === VideoPlayer.EmbeddedMpv && embeddedMpvFrameCopyEnabled) {
        return VideoPlayer.EmbeddedMpv;
    }
    return VideoPlayer.Html5Player;
}
