import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { TvPlayerControlsComponent } from './tv-player-controls.component';
import { TvWebEngineComponent } from './tv-web-engine.component';

describe('TvWebEngineComponent', () => {
    let fixture: ComponentFixture<TvWebEngineComponent>;
    let playSpy: jest.SpyInstance;

    beforeEach(async () => {
        playSpy = jest
            .spyOn(HTMLMediaElement.prototype, 'play')
            .mockResolvedValue(undefined);
        jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
            () => undefined
        );

        await TestBed.configureTestingModule({
            imports: [TvWebEngineComponent, TranslateModule.forRoot()],
        }).compileComponents();

        fixture = TestBed.createComponent(TvWebEngineComponent);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function video(): HTMLVideoElement {
        return fixture.nativeElement.querySelector('video');
    }

    /** Native fallback playback sets a `<source>` child, not `video.src` directly. */
    function videoSourceUrl(): string {
        return video().querySelector('source')?.src ?? '';
    }

    function markPlaying(): void {
        Object.defineProperty(video(), 'paused', {
            value: false,
            configurable: true,
        });
        // jsdom never advances networkState/readyState on its own (load()
        // is mocked to a no-op) — `mapVideoStatus` requires networkState
        // past NETWORK_EMPTY and readyState >= HAVE_FUTURE_DATA before it
        // will report 'playing', regardless of `paused`.
        Object.defineProperty(video(), 'networkState', {
            value: HTMLMediaElement.NETWORK_IDLE,
            configurable: true,
        });
        Object.defineProperty(video(), 'readyState', {
            value: HTMLMediaElement.HAVE_FUTURE_DATA,
            configurable: true,
        });
        video().dispatchEvent(new Event('play'));
    }

    it('sets the video source and starts playback once a stream URL is set', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        expect(videoSourceUrl()).toContain('/movie/1.mp4');
        expect(playSpy).toHaveBeenCalled();
    });

    it('seeds the resume position through the player startTime input', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.componentRef.setInput('resumeSeconds', 120);
        fixture.detectChanges();

        video().dispatchEvent(new Event('loadedmetadata'));

        expect(video().currentTime).toBe(120);
    });

    it('does not seed a resume position when none is stored', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.componentRef.setInput('resumeSeconds', 0);
        fixture.detectChanges();

        video().dispatchEvent(new Event('loadedmetadata'));

        expect(video().currentTime).toBe(0);
    });

    it('reports progress on a 5-second boundary while playing', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();
        const progress = jest.fn();
        fixture.componentInstance.playbackProgress.subscribe(progress);

        markPlaying();
        Object.defineProperty(video(), 'currentTime', {
            value: 10,
            configurable: true,
        });
        Object.defineProperty(video(), 'duration', {
            value: 7200,
            configurable: true,
        });
        video().dispatchEvent(new Event('timeupdate'));
        fixture.detectChanges();

        expect(progress).toHaveBeenCalledWith({
            positionSeconds: 10,
            durationSeconds: 7200,
        });
    });

    it('does not report progress off the interval boundary', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();
        const progress = jest.fn();
        fixture.componentInstance.playbackProgress.subscribe(progress);

        markPlaying();
        Object.defineProperty(video(), 'currentTime', {
            value: 11,
            configurable: true,
        });
        video().dispatchEvent(new Event('timeupdate'));
        fixture.detectChanges();

        expect(progress).not.toHaveBeenCalled();
    });

    it('emits exited when the mounted controls report exit', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();
        const exited = jest.fn();
        fixture.componentInstance.exited.subscribe(exited);

        const controls = fixture.debugElement.query(
            By.directive(TvPlayerControlsComponent)
        ).componentInstance as TvPlayerControlsComponent;
        controls.exited.emit();

        expect(exited).toHaveBeenCalledTimes(1);
    });

    it('forwards channel/overlay events from the mounted controls (§7.3)', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/live/1.m3u8');
        fixture.detectChanges();
        const channelChange = jest.fn();
        const openChannelBar = jest.fn();
        const overlayBack = jest.fn();
        fixture.componentInstance.channelChangeRequested.subscribe(channelChange);
        fixture.componentInstance.openChannelBarRequested.subscribe(openChannelBar);
        fixture.componentInstance.overlayBackRequested.subscribe(overlayBack);

        const controls = fixture.debugElement.query(
            By.directive(TvPlayerControlsComponent)
        ).componentInstance as TvPlayerControlsComponent;
        controls.channelChangeRequested.emit('down');
        controls.openChannelBarRequested.emit();
        controls.overlayBackRequested.emit();

        expect(channelChange).toHaveBeenCalledWith('down');
        expect(openChannelBar).toHaveBeenCalledTimes(1);
        expect(overlayBack).toHaveBeenCalledTimes(1);
    });

    it('forwards isOverlayActive down to the mounted controls', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/live/1.m3u8');
        fixture.componentRef.setInput('isOverlayActive', true);
        fixture.detectChanges();

        const controls = fixture.debugElement.query(
            By.directive(TvPlayerControlsComponent)
        ).componentInstance as TvPlayerControlsComponent;
        expect(controls.isOverlayActive()).toBe(true);
    });
});
