import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TvCatalogStateComponent } from './tv-catalog-state.component';

describe('TvCatalogStateComponent', () => {
    let fixture: ComponentFixture<TvCatalogStateComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [TvCatalogStateComponent],
        });
        fixture = TestBed.createComponent(TvCatalogStateComponent);
    });

    it('renders the loading variant with a spinner and no retry', () => {
        fixture.componentRef.setInput('variant', 'loading');
        fixture.componentRef.setInput('title', 'Loading movies');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-catalog-state__spinner')
        ).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('.tv-catalog-state__retry')
        ).toBeFalsy();
        expect(
            fixture.nativeElement.textContent
        ).toContain('Loading movies');
    });

    it('renders the empty variant with a description and no retry', () => {
        fixture.componentRef.setInput('variant', 'empty');
        fixture.componentRef.setInput('title', 'No movies');
        fixture.componentRef.setInput('description', 'This category is empty.');
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('No movies');
        expect(fixture.nativeElement.textContent).toContain(
            'This category is empty.'
        );
        expect(
            fixture.nativeElement.querySelector('.tv-catalog-state__retry')
        ).toBeFalsy();
    });

    it('renders a focusable Retry button in the error variant and emits on click', () => {
        fixture.componentRef.setInput('variant', 'error');
        fixture.componentRef.setInput('title', 'Could not load movies');
        fixture.componentRef.setInput('retryLabel', 'Retry');
        fixture.detectChanges();

        const retrySpy = jest.fn();
        fixture.componentInstance.retry.subscribe(retrySpy);

        const retryButton = fixture.debugElement.query(
            By.css('.tv-catalog-state__retry')
        );
        expect(retryButton).toBeTruthy();
        // tvFocusable registers the button and manages its tabindex — its
        // presence confirms the directive is attached (§6.2 focus primitives).
        expect(retryButton.nativeElement.getAttribute('tabindex')).toBe('-1');

        retryButton.nativeElement.click();
        expect(retrySpy).toHaveBeenCalledTimes(1);
    });
});
