import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { EmbeddedMpvSession } from '@iptvnator/shared/interfaces';
import {
    EmbeddedMpvOverlayVisibilityService,
    EmbeddedMpvPlayerComponent,
    EmbeddedMpvSessionController,
} from '@iptvnator/ui/playback';
import { TvFrameCopyEngineComponent } from './tv-frame-copy-engine.component';
import { TvPlayerControlsComponent } from './tv-player-controls.component';

@Component({
    imports: [TvFrameCopyEngineComponent],
    template: `<lib-tv-frame-copy-engine
        [streamUrl]="streamUrl()"
        [resumeSeconds]="resumeSeconds()"
        (playbackProgress)="progress($event)"
        (exited)="exit()"
    />`,
})
class HostComponent {
    streamUrl = signal('http://host/movie/1.mkv');
    resumeSeconds = signal(0);
    progress = jest.fn();
    exit = jest.fn();
}

describe('TvFrameCopyEngineComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let controller: EmbeddedMpvSessionController;
    let acquireExternalModalSurface: jest.Mock;
    let release: jest.Mock;

    const setSession = (overrides: Partial<EmbeddedMpvSession>) => {
        controller.support.set({
            supported: true,
            platform: 'linux',
            engine: 'frame-copy',
            capabilities: {
                subtitles: false,
                playbackSpeed: false,
                aspectOverride: false,
                screenshot: false,
                recording: false,
            },
        });
        controller.session.set({
            id: 'session-1',
            title: 'A Movie',
            streamUrl: 'http://host/movie/1.mkv',
            status: 'playing',
            positionSeconds: 0,
            durationSeconds: 7200,
            volume: 1,
            audioTracks: [],
            selectedAudioTrackId: null,
            subtitleTracks: [],
            selectedSubtitleTrackId: null,
            playbackSpeed: 1,
            aspectOverride: 'no',
            recording: { active: false },
            startedAt: '2026-06-06T12:00:00Z',
            updatedAt: '2026-06-06T12:00:00Z',
            ...overrides,
        });
        fixture.detectChanges();
    };

    beforeEach(async () => {
        release = jest.fn();
        acquireExternalModalSurface = jest.fn(() => release);

        await TestBed.configureTestingModule({
            imports: [HostComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: EmbeddedMpvOverlayVisibilityService,
                    useValue: {
                        overlayActive: signal(false),
                        acquireExternalModalSurface,
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();

        const playerDebugElement = fixture.debugElement.query(
            By.directive(EmbeddedMpvPlayerComponent)
        );
        controller = playerDebugElement.injector.get(
            EmbeddedMpvSessionController
        );
    });

    it('registers as an external modal surface for as long as it is mounted, to disarm the embedded player’s own shortcuts', () => {
        expect(acquireExternalModalSurface).toHaveBeenCalledTimes(1);
        expect(release).not.toHaveBeenCalled();

        fixture.destroy();

        expect(release).toHaveBeenCalledTimes(1);
    });

    it('seeds the resume position through ResolvedPortalPlayback.startTime', () => {
        fixture.componentInstance.resumeSeconds.set(321);
        fixture.detectChanges();
        setSession({});

        const engine = fixture.debugElement.query(
            By.directive(TvFrameCopyEngineComponent)
        ).componentInstance as unknown as { playback: () => { startTime?: number } };
        expect(engine.playback().startTime).toBe(321);
    });

    it('reports progress on a 5-second boundary while playing', () => {
        setSession({ positionSeconds: 10, status: 'playing' });

        expect(fixture.componentInstance.progress).toHaveBeenCalledWith({
            positionSeconds: 10,
            durationSeconds: 7200,
        });
    });

    it('does not report progress while paused', () => {
        setSession({ positionSeconds: 15, status: 'paused' });

        expect(fixture.componentInstance.progress).not.toHaveBeenCalled();
    });

    it('forwards exit from the mounted TV controls', () => {
        const controls = fixture.debugElement.query(
            By.directive(TvPlayerControlsComponent)
        ).componentInstance as TvPlayerControlsComponent;
        controls.exited.emit();

        expect(fixture.componentInstance.exit).toHaveBeenCalledTimes(1);
    });
});
