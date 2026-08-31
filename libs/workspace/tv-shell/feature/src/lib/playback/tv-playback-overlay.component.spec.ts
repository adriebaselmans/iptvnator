import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import type { PlayerMediaTitle } from '@iptvnator/ui/playback';
import { TvPlaybackOverlayComponent } from './tv-playback-overlay.component';

/**
 * `TvFrameCopyEngineComponent`/`TvWebEngineComponent` mount full real player
 * engines (hls.js/mpegts.js, or the Embedded MPV IPC session) — each has its
 * own dedicated spec. This spec only cares which one `TvPlaybackOverlayComponent`
 * picks, so both are stubbed out by selector.
 */
@Component({
    selector: 'lib-tv-frame-copy-engine',
    template: '',
})
class StubFrameCopyEngineComponent {
    readonly streamUrl = input.required<string>();
    readonly resumeSeconds = input(0);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);
    readonly isOverlayActive = input(false);
    readonly playbackProgress = output<{
        positionSeconds: number;
        durationSeconds: number | null;
    }>();
    readonly channelChangeRequested = output<'up' | 'down'>();
    readonly openChannelBarRequested = output<void>();
    readonly overlayBackRequested = output<void>();
    readonly exited = output<void>();
}

@Component({
    selector: 'lib-tv-web-engine',
    template: '',
})
class StubWebEngineComponent {
    readonly streamUrl = input.required<string>();
    readonly resumeSeconds = input(0);
    readonly isLive = input(false);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);
    readonly isOverlayActive = input(false);
    readonly playbackProgress = output<{
        positionSeconds: number;
        durationSeconds: number | null;
    }>();
    readonly channelChangeRequested = output<'up' | 'down'>();
    readonly openChannelBarRequested = output<void>();
    readonly overlayBackRequested = output<void>();
    readonly exited = output<void>();
}

describe('TvPlaybackOverlayComponent', () => {
    let fixture: ComponentFixture<TvPlaybackOverlayComponent>;
    let electron: { getEmbeddedMpvSupport: jest.Mock } | undefined;

    beforeEach(async () => {
        electron = undefined;
        Object.defineProperty(window, 'electron', {
            configurable: true,
            get: () => electron,
        });

        TestBed.configureTestingModule({
            imports: [TvPlaybackOverlayComponent, TranslateModule.forRoot()],
        });
        TestBed.overrideComponent(TvPlaybackOverlayComponent, {
            set: {
                imports: [
                    TranslateModule,
                    StubFrameCopyEngineComponent,
                    StubWebEngineComponent,
                ],
            },
        });
        await TestBed.compileComponents();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    /**
     * `TvPlaybackOverlayComponent` reads `window.electron` synchronously in
     * its constructor, so `electron` must be set BEFORE the fixture is
     * created — assigning it inside the `it()` body after an earlier
     * `TestBed.createComponent()` call would be too late.
     */
    function createFixture(): void {
        fixture = TestBed.createComponent(TvPlaybackOverlayComponent);
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mkv');
    }

    /**
     * Waits out the probe's promise chain. `fixture.whenStable()` relies on
     * NgZone task tracking, which this project's zoneless TestBed
     * configuration does not provide — a macrotask tick reliably drains the
     * microtask queue (including the async probe's `await` chain)
     * regardless of zone tracking.
     */
    function flushProbe(): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve));
    }

    it('starts on the web engine so there is never a dead screen while the probe is in flight', () => {
        createFixture();
        fixture.detectChanges();

        expect(
            fixture.debugElement.query(By.directive(StubWebEngineComponent))
        ).toBeTruthy();
        expect(
            fixture.debugElement.query(By.directive(StubFrameCopyEngineComponent))
        ).toBeFalsy();
    });

    it('switches to the frame-copy engine once the runtime probe confirms availability', async () => {
        electron = {
            getEmbeddedMpvSupport: jest.fn(() =>
                Promise.resolve({
                    supported: true,
                    platform: 'linux',
                    engine: 'frame-copy',
                })
            ),
        };
        createFixture();
        fixture.detectChanges();
        await flushProbe();
        fixture.detectChanges();

        expect(
            fixture.debugElement.query(By.directive(StubFrameCopyEngineComponent))
        ).toBeTruthy();
        expect(
            fixture.debugElement.query(By.directive(StubWebEngineComponent))
        ).toBeFalsy();
    });

    it('falls through to the web engine when the probe reports native-view only', async () => {
        electron = {
            getEmbeddedMpvSupport: jest.fn(() =>
                Promise.resolve({
                    supported: true,
                    platform: 'darwin',
                    engine: 'native',
                })
            ),
        };
        createFixture();
        fixture.detectChanges();
        await flushProbe();
        fixture.detectChanges();

        expect(
            fixture.debugElement.query(By.directive(StubWebEngineComponent))
        ).toBeTruthy();
    });

    it('falls through to the web engine when the probe rejects', async () => {
        electron = {
            getEmbeddedMpvSupport: jest.fn(() =>
                Promise.reject(new Error('ipc timeout'))
            ),
        };
        createFixture();
        fixture.detectChanges();
        await flushProbe();
        fixture.detectChanges();

        expect(
            fixture.debugElement.query(By.directive(StubWebEngineComponent))
        ).toBeTruthy();
    });

    it('forwards playback progress and exit from whichever engine is mounted', () => {
        createFixture();
        fixture.detectChanges();
        const progress = jest.fn();
        const exited = jest.fn();
        fixture.componentInstance.playbackProgress.subscribe(progress);
        fixture.componentInstance.exited.subscribe(exited);

        const stub = fixture.debugElement.query(
            By.directive(StubWebEngineComponent)
        ).componentInstance as StubWebEngineComponent;
        stub.playbackProgress.emit({ positionSeconds: 5, durationSeconds: 100 });
        stub.exited.emit();

        expect(progress).toHaveBeenCalledWith({
            positionSeconds: 5,
            durationSeconds: 100,
        });
        expect(exited).toHaveBeenCalledTimes(1);
    });

    it('forwards channel/overlay events from whichever engine is mounted (§7.3)', () => {
        createFixture();
        fixture.detectChanges();
        const channelChange = jest.fn();
        const openChannelBar = jest.fn();
        const overlayBack = jest.fn();
        fixture.componentInstance.channelChangeRequested.subscribe(channelChange);
        fixture.componentInstance.openChannelBarRequested.subscribe(openChannelBar);
        fixture.componentInstance.overlayBackRequested.subscribe(overlayBack);

        const stub = fixture.debugElement.query(
            By.directive(StubWebEngineComponent)
        ).componentInstance as StubWebEngineComponent;
        stub.channelChangeRequested.emit('up');
        stub.openChannelBarRequested.emit();
        stub.overlayBackRequested.emit();

        expect(channelChange).toHaveBeenCalledWith('up');
        expect(openChannelBar).toHaveBeenCalledTimes(1);
        expect(overlayBack).toHaveBeenCalledTimes(1);
    });

    it('forwards isOverlayActive down to the mounted engine', () => {
        createFixture();
        fixture.componentRef.setInput('isOverlayActive', true);
        fixture.detectChanges();

        const stub = fixture.debugElement.query(
            By.directive(StubWebEngineComponent)
        ).componentInstance as StubWebEngineComponent;
        expect(stub.isOverlayActive()).toBe(true);
    });

    it('surfaces the resolved engine in the badge', async () => {
        electron = {
            getEmbeddedMpvSupport: jest.fn(() =>
                Promise.resolve({
                    supported: true,
                    platform: 'linux',
                    engine: 'frame-copy',
                })
            ),
        };
        createFixture();
        fixture.detectChanges();
        await flushProbe();
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector(
            '.tv-playback-overlay__engine-badge'
        );
        expect(badge.textContent).toContain('TV.PLAYBACK.ENGINE_FRAME_COPY');
    });

    it('shows the web engine label while unresolved', () => {
        createFixture();
        fixture.detectChanges();

        const badge = fixture.nativeElement.querySelector(
            '.tv-playback-overlay__engine-badge'
        );
        expect(badge.textContent).toContain('TV.PLAYBACK.ENGINE_WEB');
    });
});
