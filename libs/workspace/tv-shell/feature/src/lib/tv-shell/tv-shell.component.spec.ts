import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
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
});
