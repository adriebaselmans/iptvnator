import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import {
    PlaybackDiagnosticCode,
    PlaybackDiagnosticSource,
    type PlaybackDiagnostic,
} from '@iptvnator/playback/util';
import { HtmlVideoPlayerComponent } from '@iptvnator/ui/playback';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TvPlayerControlsComponent } from './tv-player-controls.component';
import { TvWebEngineComponent } from './tv-web-engine.component';

const NETWORK_ERROR_DIAGNOSTIC: PlaybackDiagnostic = {
    code: PlaybackDiagnosticCode.NetworkError,
    source: PlaybackDiagnosticSource.Native,
    sourceUrl: 'http://host/movie/1.mp4',
    container: 'mp4',
    audioCodecs: [],
    videoCodecs: [],
};

describe('TvWebEngineComponent', () => {
    let fixture: ComponentFixture<TvWebEngineComponent>;
    let playSpy: jest.SpyInstance;
    let loadSpy: jest.SpyInstance;

    beforeEach(async () => {
        playSpy = jest
            .spyOn(HTMLMediaElement.prototype, 'play')
            .mockResolvedValue(undefined);
        loadSpy = jest
            .spyOn(HTMLMediaElement.prototype, 'load')
            .mockImplementation(() => undefined);

        await TestBed.configureTestingModule({
            imports: [TvWebEngineComponent, TranslateModule.forRoot()],
        }).compileComponents();

        fixture = TestBed.createComponent(TvWebEngineComponent);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function htmlPlayer(): HtmlVideoPlayerComponent {
        return fixture.debugElement.query(By.directive(HtmlVideoPlayerComponent))
            .componentInstance as HtmlVideoPlayerComponent;
    }

    function errorState(): HTMLElement | null {
        return fixture.nativeElement.querySelector('.tv-web-engine__error');
    }

    function retryButton(): HTMLElement | null {
        return fixture.nativeElement.querySelector('.tv-catalog-state__retry');
    }

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

    it('does not show the error state when nothing has failed', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        expect(errorState()).toBeFalsy();
        expect(
            fixture.debugElement.query(By.directive(TvPlayerControlsComponent))
        ).toBeTruthy();
    });

    it('renders a focusable error state when the player reports a playback issue', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        htmlPlayer().playbackIssue.emit(NETWORK_ERROR_DIAGNOSTIC);
        fixture.detectChanges();

        expect(errorState()).toBeTruthy();
        // The controls are unmounted while an error is shown: they register a
        // playback session that would swallow OK/arrow keys as transport
        // input instead of letting them move focus to Retry (§6.3/§9.2).
        expect(
            fixture.debugElement.query(By.directive(TvPlayerControlsComponent))
        ).toBeFalsy();

        const retry = retryButton();
        expect(retry).toBeTruthy();
        // Synchronously after the error renders, its focus group exists but
        // is not yet active — activation is deferred to a microtask (see the
        // next test), so this is the expected starting state, not a defect.
        expect(retry?.getAttribute('tabindex')).toBe('-1');
    });

    it('makes Retry the active focus target, not merely present (§6.4)', async () => {
        // Regresses a real defect: the error state rendered and registered
        // its own focus group, but nothing ever called
        // `TvFocusService.setActive()` for it. Retry was visible but
        // unreachable — OK did nothing, because real DOM focus and
        // `TvFocusService.activeElement()` stayed on whatever the host
        // screen had focused before playback started. Confirmed against a
        // real remote-driven Electron instance before this test was written.
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        htmlPlayer().playbackIssue.emit(NETWORK_ERROR_DIAGNOSTIC);
        fixture.detectChanges();
        // Flush the `queueMicrotask()` the activation is deferred through.
        await Promise.resolve();
        await Promise.resolve();
        fixture.detectChanges();

        const focusService = TestBed.inject(TvFocusService);
        expect(focusService.activeGroupId()).toBe('tv-web-engine-playback-retry');
        expect(focusService.activeElement()).toBe(retryButton());
        expect(retryButton()?.getAttribute('tabindex')).toBe('0');
    });

    it('clears the error state and restores the video when the issue resolves to null', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        htmlPlayer().playbackIssue.emit(NETWORK_ERROR_DIAGNOSTIC);
        fixture.detectChanges();
        expect(errorState()).toBeTruthy();

        htmlPlayer().playbackIssue.emit(null);
        fixture.detectChanges();

        expect(errorState()).toBeFalsy();
        expect(
            fixture.debugElement.query(By.directive(TvPlayerControlsComponent))
        ).toBeTruthy();
    });

    it('re-applies the current stream on retry instead of leaving it a no-op', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();
        const loadCallsBeforeRetry = loadSpy.mock.calls.length;
        const playCallsBeforeRetry = playSpy.mock.calls.length;
        expect(loadCallsBeforeRetry).toBeGreaterThan(0);

        htmlPlayer().playbackIssue.emit(NETWORK_ERROR_DIAGNOSTIC);
        fixture.detectChanges();
        expect(retryButton()).toBeTruthy();

        retryButton()?.click();
        fixture.detectChanges();

        // A real, observable side effect of `playChannel()` running again —
        // not just a changed object reference — proves retry is not a no-op.
        expect(loadSpy.mock.calls.length).toBeGreaterThan(loadCallsBeforeRetry);
        expect(playSpy.mock.calls.length).toBeGreaterThan(playCallsBeforeRetry);
        expect(errorState()).toBeFalsy();
        expect(
            fixture.debugElement.query(By.directive(TvPlayerControlsComponent))
        ).toBeTruthy();
    });
});
