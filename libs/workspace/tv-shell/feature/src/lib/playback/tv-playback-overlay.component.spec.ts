import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { TvPlaybackOverlayComponent } from './tv-playback-overlay.component';
import { TvPlayerControlsComponent } from './tv-player-controls.component';

describe('TvPlaybackOverlayComponent', () => {
    let fixture: ComponentFixture<TvPlaybackOverlayComponent>;
    let playSpy: jest.SpyInstance;

    beforeEach(async () => {
        playSpy = jest
            .spyOn(HTMLMediaElement.prototype, 'play')
            .mockResolvedValue(undefined);
        jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
            () => undefined
        );

        await TestBed.configureTestingModule({
            imports: [TvPlaybackOverlayComponent, TranslateModule.forRoot()],
        }).compileComponents();

        fixture = TestBed.createComponent(TvPlaybackOverlayComponent);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function video(): HTMLVideoElement {
        return fixture.nativeElement.querySelector('video');
    }

    it('sets the video source and starts playback once a stream URL is set', () => {
        fixture.componentRef.setInput('streamUrl', 'http://host/movie/1.mp4');
        fixture.detectChanges();

        expect(video().src).toContain('/movie/1.mp4');
        expect(playSpy).toHaveBeenCalled();
    });

    it('seeds the resume position once metadata is available', () => {
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
});
