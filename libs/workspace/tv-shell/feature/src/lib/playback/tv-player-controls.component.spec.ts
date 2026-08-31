import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
    createEmptyControlsState,
    DEFAULT_PLAYER_CAPABILITIES,
    type PlayerController,
    type PlayerControlsCommands,
} from '@iptvnator/ui/playback';
import { TvPlaybackSessionService } from './tv-playback-session.service';
import { TvPlayerControlsComponent } from './tv-player-controls.component';

function fakeCommands(): jest.Mocked<PlayerControlsCommands> {
    return {
        togglePlay: jest.fn(),
        seekTo: jest.fn(),
        seekBy: jest.fn(),
        setVolume: jest.fn(),
        setAudioTrack: jest.fn(),
        setSubtitleTrack: jest.fn(),
        addExternalSubtitleFile: jest.fn(),
        setSubtitleDelay: jest.fn(),
        setSubtitleStyle: jest.fn(),
        setQualityLevel: jest.fn(),
        setPlaybackSpeed: jest.fn(),
        setAspectRatio: jest.fn(),
        toggleRecording: jest.fn(),
        togglePictureInPicture: jest.fn(),
    };
}

/** A faked `PlayerController` — this component never reaches into a real engine. */
function fakeController(): PlayerController {
    return {
        capabilities: signal(DEFAULT_PLAYER_CAPABILITIES),
        state: signal(createEmptyControlsState()),
        commands: fakeCommands(),
    };
}

describe('TvPlayerControlsComponent', () => {
    let fixture: ComponentFixture<TvPlayerControlsComponent>;
    let sessionService: TvPlaybackSessionService;
    let controller: PlayerController;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TvPlayerControlsComponent, TranslateModule.forRoot()],
        }).compileComponents();

        sessionService = TestBed.inject(TvPlaybackSessionService);
        fixture = TestBed.createComponent(TvPlayerControlsComponent);
        controller = fakeController();
        fixture.componentRef.setInput('controller', controller);
        fixture.detectChanges();
    });

    it('registers the mounted controller with the playback session service', () => {
        expect(sessionService.active()?.controller).toBe(controller);
    });

    it('reports live state through the registered session', () => {
        fixture.componentRef.setInput('isLive', true);
        fixture.detectChanges();

        expect(sessionService.active()?.isLive()).toBe(true);
    });

    it('emits exited when the session reports exit', () => {
        const exited = jest.fn();
        fixture.componentInstance.exited.subscribe(exited);

        sessionService.active()?.onExit();

        expect(exited).toHaveBeenCalledTimes(1);
    });

    it('emits channelChangeRequested when the session reports a channel change', () => {
        const channelChange = jest.fn();
        fixture.componentInstance.channelChangeRequested.subscribe(channelChange);

        sessionService.active()?.onChannelChange?.('up');

        expect(channelChange).toHaveBeenCalledWith('up');
    });

    it('emits openChannelBarRequested when the session reports it (§7.3)', () => {
        const openChannelBar = jest.fn();
        fixture.componentInstance.openChannelBarRequested.subscribe(openChannelBar);

        sessionService.active()?.onOpenChannelBar?.();

        expect(openChannelBar).toHaveBeenCalledTimes(1);
    });

    it('reports isOverlayActive through the registered session', () => {
        fixture.componentRef.setInput('isOverlayActive', true);
        fixture.detectChanges();

        expect(sessionService.active()?.isOverlayActive?.()).toBe(true);
    });

    it('emits overlayBackRequested when the session reports it', () => {
        const overlayBack = jest.fn();
        fixture.componentInstance.overlayBackRequested.subscribe(overlayBack);

        sessionService.active()?.onOverlayBack?.();

        expect(overlayBack).toHaveBeenCalledTimes(1);
    });

    it('unregisters the session on destroy', () => {
        fixture.destroy();

        expect(sessionService.active()).toBeNull();
    });
});
