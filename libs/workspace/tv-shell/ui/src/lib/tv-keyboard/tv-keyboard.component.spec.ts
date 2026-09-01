import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TvKeyboardComponent } from './tv-keyboard.component';

@Component({
    template: `
        <lib-tv-keyboard
            focusGroupId="kb"
            (charEntered)="entered.push($event)"
            (backspacePressed)="backspaces = backspaces + 1"
            (cleared)="clears = clears + 1"
        />
    `,
    imports: [TvKeyboardComponent],
})
class HostComponent {
    entered: string[] = [];
    backspaces = 0;
    clears = 0;
}

describe('TvKeyboardComponent', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HostComponent, TranslateModule.forRoot()],
        });
        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
    });

    function keyButton(id: string): HTMLButtonElement {
        const buttons: HTMLButtonElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('.tv-keyboard__key')
        );
        const order = keysOrder();
        const target = buttons[order.indexOf(id)];
        if (!target) throw new Error(`key ${id} not found`);
        return target;
    }

    function keysOrder(): string[] {
        const digits = '0123456789'.split('');
        const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
        return [
            ...digits.map((d) => `char-${d}`),
            ...letters.map((l) => `char-${l}`),
            'space',
            'backspace',
            'clear',
        ];
    }

    it('renders 39 focusable keys as a fixed-column grid group', () => {
        const buttons =
            fixture.nativeElement.querySelectorAll('.tv-keyboard__key');
        expect(buttons.length).toBe(39);
    });

    it('emits charEntered with the lowercase value when a letter key is clicked', () => {
        keyButton('char-a').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.entered).toEqual(['a']);
    });

    it('emits charEntered with a space when the space key is clicked', () => {
        keyButton('space').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.entered).toEqual([' ']);
    });

    it('emits backspacePressed when the backspace key is clicked', () => {
        keyButton('backspace').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.backspaces).toBe(1);
    });

    it('emits cleared when the clear key is clicked', () => {
        keyButton('clear').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.clears).toBe(1);
    });
});
