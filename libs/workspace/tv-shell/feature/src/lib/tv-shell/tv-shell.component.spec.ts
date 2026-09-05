import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsStore } from '@iptvnator/services';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import { TV_NAV_GROUP_ID } from '../nav/tv-nav-bar.util';
import {
    TvPlaybackSession,
    TvPlaybackSessionService,
} from '../playback/tv-playback-session.service';
import { TvShellComponent } from './tv-shell.component';

/**
 * Dispatches the way a browser genuinely delivers a keypress: on whatever
 * currently holds real DOM focus, letting it bubble up to the shell's
 * `@HostListener('keydown')`. Dispatching directly on
 * `fixture.nativeElement` (the shell host) used to make this suite pass
 * regardless of whether anything in the shell ever moved real focus there —
 * `fixture.nativeElement` *is* the listener's own element, so the dispatch
 * always "worked" even when the shell never called `.focus()` on anything
 * and a real keydown targeting `<body>` would never have bubbled down into
 * it. Falls back to the shell root only if literally nothing is focused.
 */
function dispatchKeydown(
    fixture: ComponentFixture<TvShellComponent>,
    key: string
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    (document.activeElement ?? fixture.nativeElement).dispatchEvent(event);
    return event;
}

describe('TvShellComponent', () => {
    let fixture: ComponentFixture<TvShellComponent>;
    let focusService: {
        move: jest.Mock;
        activeElement: jest.Mock;
        setActive: jest.Mock;
    };
    let locationBackSpy: jest.SpyInstance;
    let router: Router;
    let settingsStore: { updateSettings: jest.Mock };

    beforeEach(async () => {
        focusService = {
            move: jest.fn(),
            activeElement: jest.fn(() => null),
            setActive: jest.fn(),
        };
        settingsStore = {
            updateSettings: jest.fn().mockResolvedValue(undefined),
        };

        await TestBed.configureTestingModule({
            imports: [TvShellComponent, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: TvFocusService, useValue: focusService },
                { provide: SettingsStore, useValue: settingsStore },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TvShellComponent);
        fixture.detectChanges();
        locationBackSpy = jest.spyOn(TestBed.inject(Location), 'back');
        router = TestBed.inject(Router);
    });

    /** `Router.url` is read-only in real navigation; stubbed for a unit test. */
    function stubCurrentUrl(url: string): void {
        Object.defineProperty(router, 'url', {
            value: url,
            configurable: true,
        });
    }

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
            stubCurrentUrl('/tv/xtreams/abc/live');

            const event = dispatchKeydown(fixture, key);

            expect(locationBackSpy).toHaveBeenCalledTimes(1);
            expect(event.defaultPrevented).toBe(true);
        }
    );

    describe('Back at the TV home route (§6.1 leave-TV-mode confirm)', () => {
        beforeEach(() => {
            stubCurrentUrl('/tv/xtreams/abc/home');
        });

        it('opens the leave confirmation instead of calling Location.back()', () => {
            dispatchKeydown(fixture, 'Backspace');

            expect(fixture.componentInstance['showLeaveConfirm']()).toBe(true);
            expect(locationBackSpy).not.toHaveBeenCalled();
        });

        it('a second Back closes the confirmation and restores nav-bar focus', () => {
            dispatchKeydown(fixture, 'Backspace');
            focusService.setActive.mockClear();

            dispatchKeydown(fixture, 'Backspace');

            expect(fixture.componentInstance['showLeaveConfirm']()).toBe(false);
            expect(focusService.setActive).toHaveBeenCalledWith(
                TV_NAV_GROUP_ID,
                0
            );
            expect(locationBackSpy).not.toHaveBeenCalled();
        });

        it('onStayInTvMode closes the confirmation without navigating away', () => {
            fixture.componentInstance['onStayInTvMode']();

            expect(fixture.componentInstance['showLeaveConfirm']()).toBe(false);
            expect(focusService.setActive).toHaveBeenCalledWith(
                TV_NAV_GROUP_ID,
                0
            );
        });

        it('onExitTvMode closes the confirmation, persists startInTvMode=false, and navigates to the desktop workspace', () => {
            const navigateSpy = jest
                .spyOn(router, 'navigateByUrl')
                .mockResolvedValue(true);

            fixture.componentInstance['onExitTvMode']();

            expect(fixture.componentInstance['showLeaveConfirm']()).toBe(false);
            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                startInTvMode: false,
            });
            expect(navigateSpy).toHaveBeenCalledWith('/workspace');
        });

        it('onExitTvMode still navigates to the desktop workspace when persisting the setting fails', async () => {
            const navigateSpy = jest
                .spyOn(router, 'navigateByUrl')
                .mockResolvedValue(true);
            settingsStore.updateSettings.mockRejectedValue(
                new Error('storage unavailable')
            );
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);

            fixture.componentInstance['onExitTvMode']();
            await Promise.resolve();
            await Promise.resolve();

            expect(navigateSpy).toHaveBeenCalledWith('/workspace');
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

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
                    capabilities: () => ({ seek: true }) as never,
                    state: () => ({ canSeek: true }) as never,
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
            expect(
                session.controller.commands.togglePlay
            ).toHaveBeenCalledTimes(1);
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
                    capabilities: () => ({ seek: false }) as never,
                    state: () => ({ canSeek: false }) as never,
                    commands: {
                        togglePlay: jest.fn(),
                        seekBy: jest.fn(),
                    } as never,
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

        it('routes Enter to onOpenChannelBar instead of togglePlay during live playback (§7.3)', () => {
            const sessionService = TestBed.inject(TvPlaybackSessionService);
            const onOpenChannelBar = jest.fn();
            const session = fakeSession({
                isLive: () => true,
                onOpenChannelBar,
            });
            sessionService.register(session);

            dispatchKeydown(fixture, 'Enter');

            expect(onOpenChannelBar).toHaveBeenCalledTimes(1);
            expect(
                session.controller.commands.togglePlay
            ).not.toHaveBeenCalled();
        });

        describe('while the session reports an active overlay (channel bar/EPG grid)', () => {
            it('routes Up/Down/Enter through ordinary focus intents instead of playback intents', () => {
                const sessionService = TestBed.inject(TvPlaybackSessionService);
                const session = fakeSession({
                    isLive: () => true,
                    isOverlayActive: () => true,
                });
                sessionService.register(session);

                dispatchKeydown(fixture, 'ArrowUp');

                expect(focusService.move).toHaveBeenCalledWith('up');
                expect(session.onChannelChange).toBeUndefined();
            });

            it('routes Back to onOverlayBack instead of onExit or Location.back()', () => {
                const sessionService = TestBed.inject(TvPlaybackSessionService);
                const onOverlayBack = jest.fn();
                const session = fakeSession({
                    isLive: () => true,
                    isOverlayActive: () => true,
                    onOverlayBack,
                });
                sessionService.register(session);

                dispatchKeydown(fixture, 'Backspace');

                expect(onOverlayBack).toHaveBeenCalledTimes(1);
                expect(session.onExit).not.toHaveBeenCalled();
                expect(locationBackSpy).not.toHaveBeenCalled();
            });
        });
    });
});
