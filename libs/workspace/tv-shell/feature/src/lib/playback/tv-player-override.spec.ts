import { VideoPlayer } from '@iptvnator/shared/interfaces';
import { resolveTvPlayerOverride } from './tv-player-override';

describe('resolveTvPlayerOverride', () => {
    it.each([VideoPlayer.Html5Player, VideoPlayer.VideoJs, VideoPlayer.ArtPlayer])(
        'permits the web engine %s unchanged',
        (player) => {
            expect(resolveTvPlayerOverride(player, false)).toBe(player);
            expect(resolveTvPlayerOverride(player, true)).toBe(player);
        }
    );

    it('excludes native-view Embedded MPV, forcing HTML5', () => {
        expect(resolveTvPlayerOverride(VideoPlayer.EmbeddedMpv, false)).toBe(
            VideoPlayer.Html5Player
        );
    });

    it('permits Embedded MPV frame-copy unchanged', () => {
        expect(resolveTvPlayerOverride(VideoPlayer.EmbeddedMpv, true)).toBe(
            VideoPlayer.EmbeddedMpv
        );
    });

    it('excludes external MPV, forcing HTML5', () => {
        expect(resolveTvPlayerOverride(VideoPlayer.MPV, false)).toBe(
            VideoPlayer.Html5Player
        );
        expect(resolveTvPlayerOverride(VideoPlayer.MPV, true)).toBe(
            VideoPlayer.Html5Player
        );
    });

    it('excludes external VLC, forcing HTML5', () => {
        expect(resolveTvPlayerOverride(VideoPlayer.VLC, false)).toBe(
            VideoPlayer.Html5Player
        );
    });

    it('forces HTML5 when no player is resolved yet', () => {
        expect(resolveTvPlayerOverride(null, false)).toBe(VideoPlayer.Html5Player);
        expect(resolveTvPlayerOverride(undefined, false)).toBe(
            VideoPlayer.Html5Player
        );
    });
});
