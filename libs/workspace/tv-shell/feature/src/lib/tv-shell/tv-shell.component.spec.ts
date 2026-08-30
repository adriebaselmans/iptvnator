import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvPlaybackSession,
    TvPlaybackSessionService,
} from '../playback/tv-playback-session.service';
import { TvShellComponent } from './tv-shell.component';

function dispatchKeydown(
    fixture: ComponentFixture<TvShellComponent>,
    key: string
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    fixture.nativeElement.dispatchEvent(event);
    return event;
}

describe('TvShellComponent', () => {
    let fixture: ComponentFixture<TvShellComponent>;
    let focusService: { move: jest.Mock; activeElement: jest.Mock };
    let locationBackSpy: jest.SpyInstance;

    beforeEach(async () => {
        focusService = { move: jest.fn(), activeElement: jest.fn(() => null) };

        await TestBed.configureTestingModule({
            imports: [TvShellComponent],
            providers: [
                provideRouter([]),
                { provide: TvFocusService, useValue: focusService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TvShellComponent);
        fixture.detectChanges();
        locationBackSpy = jest.spyOn(TestBed.inject(Location), 'back');
    });

    it.each([
        ['ArrowUp', 'up'],
        ['ArrowDown', 'down'],
        ['ArrowLeft', 'left'],
        ['ArrowRight', 'right'],
    ] as const)(
        '%s moves focus %s and prevents the default action',
        (key, direction) => {
            const event = dispatchKeydown(fixture, key);

            expect(focusService.move).toHaveBeenCalledWith(direction);
            expect(event.defaultPrevented).toBe(true);
        }
    );

    it('Enter activates the element the focus service reports and prevents default', () => {
        const button = document.createElement('button');
        const clickSpy = jest.fn();
        button.addEventListener('click', clickSpy);
        fixture.nativeElement.appendChild(button);
        focusService.activeElement.mockReturnValue(button);

        const event = dispatchKeydown(fixture, 'Enter');

        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('Enter activates a focused element rendered OUTSIDE the shell subtree', () => {
        // Overlays (channel bar, EPG grid) render into the CDK overlay
        // container attached to the body, not into the shell's own subtree.
        // Resolving the target by querying that subtree would silently miss
        // them and leave OK doing nothing.
        const overlayContainer = document.createElement('div');
        document.body.appendChild(overlayContainer);
        const button = document.createElement('button');
        const clickSpy = jest.fn();
        button.addEventListener('click', clickSpy);
        overlayContainer.appendChild(button);
        focusService.activeElement.mockReturnValue(button);

        expect(fixture.nativeElement.contains(button)).toBe(false);

        const event = dispatchKeydown(fixture, 'Enter');

        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);

        overlayContainer.remove();
    });

    it('Enter is harmless when nothing holds focus', () => {
        focusService.activeElement.mockReturnValue(null);

        expect(() => dispatchKeydown(fixture, 'Enter')).not.toThrow();
    });

    it.each(['Backspace', 'Escape'])(
        '%s goes back and prevents default',
        (key) => {
            const event = dispatchKeydown(fixture, key);

            expect(locationBackSpy).toHaveBeenCalledTimes(1);
            expect(event.defaultPrevented).toBe(true);
        }
    );

    it.each(['a', 'Tab', ' ', 'F5', 'Shift'])(
        '%s is ignored: no focus move, no activation, no back, no preventDefault',
        (key) => {
            const event = dispatchKeydown(fixture, key);

            expect(focusService.move).not.toHaveBeenCalled();
            expect(locationBackSpy).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        }
    );

    describe('with a mounted playback session (§9.2)', () => {
        function fakeSession(
            overrides: Partial<TvPlaybackSession> = {}
        ): TvPlaybackSession {
            return {
                controller: {
                    capabilities: () => ({ seek: true } as never),
                    state: () => ({ canSeek: true } as never),
                    commands: {
                        togglePlay: jest.fn(),
                        seekBy: jest.fn(),
                    } as never,
                },
                isLive: () => false,
                reveal: jest.fn(),
                onExit: jest.fn(),
                ...overrides,
            };
        }

        it('routes Enter to togglePlay and reveal instead of activation', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const session = fakeSession();
            sessionService.register(session);

            const event = dispatchKeydown(fixture, 'Enter');

            expect(session.reveal).toHaveBeenCalledTimes(1);
            expect(session.controller.commands.togglePlay).toHaveBeenCalledTimes(
                1
            );
            expect(focusService.move).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(true);
        });

        it('routes Left/Right to a gated seekBy', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const session = fakeSession();
            sessionService.register(session);

            dispatchKeydown(fixture, 'ArrowRight');

            expect(session.controller.commands.seekBy).toHaveBeenCalledWith(10);
        });

        it('refuses to seek when the controller cannot currently seek', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const session = fakeSession({
                controller: {
                    capabilities: () => ({ seek: false } as never),
                    state: () => ({ canSeek: false } as never),
                    commands: { togglePlay: jest.fn(), seekBy: jest.fn() } as never,
                },
            });
            sessionService.register(session);

            dispatchKeydown(fixture, 'ArrowRight');

            expect(session.controller.commands.seekBy).not.toHaveBeenCalled();
        });

        it('routes Backspace/Escape to onExit instead of Location.back()', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const session = fakeSession();
            sessionService.register(session);

            dispatchKeydown(fixture, 'Backspace');

            expect(session.onExit).toHaveBeenCalledTimes(1);
            expect(locationBackSpy).not.toHaveBeenCalled();
        });

        it('routes Up/Down to onChannelChange during live playback', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const onChannelChange = jest.fn();
            const session = fakeSession({
                isLive: () => true,
                onChannelChange,
            });
            sessionService.register(session);

            dispatchKeydown(fixture, 'ArrowUp');
            dispatchKeydown(fixture, 'ArrowDown');

            expect(onChannelChange).toHaveBeenNthCalledWith(1, 'up');
            expect(onChannelChange).toHaveBeenNthCalledWith(2, 'down');
        });
    });
});
