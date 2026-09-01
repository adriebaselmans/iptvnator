import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvHomeHeroComponent } from './tv-home-hero.component';

@Component({
    template: `
        <lib-tv-home-hero
            tvFocusGroup="hero"
            title="Dune"
            resumeLabel="Resume"
            (resumeActivated)="resumed = true"
        />
    `,
    imports: [TvHomeHeroComponent],
})
class HostComponent {
    resumed = false;
}

describe('TvHomeHeroComponent', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
    });

    it('renders the title and resume label', () => {
        const el: HTMLElement = fixture.nativeElement;
        expect(el.querySelector('.tv-home-hero__title')?.textContent).toContain(
            'Dune'
        );
        expect(
            el.querySelector('.tv-home-hero__resume')?.textContent
        ).toContain('Resume');
    });

    it('emits resumeActivated when the resume button is clicked', () => {
        const button: HTMLButtonElement = fixture.nativeElement.querySelector(
            '.tv-home-hero__resume'
        );
        button.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.resumed).toBe(true);
    });

    it('registers the resume button as focusable within its own group', () => {
        const button: HTMLButtonElement = fixture.nativeElement.querySelector(
            '.tv-home-hero__resume'
        );
        expect(button.getAttribute('tabindex')).not.toBeNull();
    });
});
