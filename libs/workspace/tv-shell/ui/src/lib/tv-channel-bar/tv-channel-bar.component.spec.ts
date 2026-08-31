import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvFocusService } from '@iptvnator/ui/tv-navigation';
import {
    TvChannelBarComponent,
    type TvChannelBarItem,
    type TvChannelBarProgramme,
} from './tv-channel-bar.component';

function makeChannels(count: number): TvChannelBarItem[] {
    return Array.from({ length: count }, (_, index) => ({
        id: index,
        name: `Channel ${index}`,
    }));
}

@Component({
    template: `
        <lib-tv-channel-bar
            tvFocusGroup="test-bar"
            orientation="column"
            [channels]="channels()"
            [playingChannelId]="playingChannelId()"
            [highlightedProgramme]="highlightedProgramme()"
            [hasMore]="hasMore()"
            [appending]="appending()"
            (channelActivated)="onActivated($event)"
            (loadMoreRequested)="loadMoreRequested()"
        />
    `,
    imports: [TvChannelBarComponent],
})
class HostComponent {
    readonly channels = signal<TvChannelBarItem[]>(makeChannels(5));
    readonly playingChannelId = signal<number | null>(0);
    readonly highlightedProgramme = signal<TvChannelBarProgramme | null>(null);
    readonly hasMore = signal(true);
    readonly appending = signal(false);
    activated: TvChannelBarItem | null = null;
    loadMoreCallCount = 0;

    onActivated(item: TvChannelBarItem): void {
        this.activated = item;
    }

    loadMoreRequested(): void {
        this.loadMoreCallCount++;
    }
}

describe('TvChannelBarComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let focusService: TvFocusService;

    beforeEach(() => {
        TestBed.configureTestingModule({ imports: [HostComponent] });
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        focusService = TestBed.inject(TvFocusService);
        fixture.detectChanges();
    });

    it('renders one button per channel', () => {
        const buttons = fixture.nativeElement.querySelectorAll(
            '.tv-channel-bar__item'
        );
        expect(buttons.length).toBe(5);
    });

    it('emits channelActivated when a row is clicked', () => {
        const buttons = fixture.nativeElement.querySelectorAll(
            '.tv-channel-bar__item'
        );
        buttons[2].click();
        expect(host.activated).toEqual({ id: 2, name: 'Channel 2' });
    });

    it('shows the highlighted programme title when provided', () => {
        host.highlightedProgramme.set({
            title: 'The News',
            startMs: 0,
            stopMs: 1000,
        });
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.tv-channel-bar__programme-title')
                .textContent
        ).toContain('The News');
    });

    it('moves Up/Down within the list instead of exiting the group (§7.3)', () => {
        // Regression: the focus group directive defaults to `row`
        // orientation, under which Up/Down exit the group instead of moving
        // within it. The caller must explicitly set orientation="column".
        focusService.setActive('test-bar', 0);
        focusService.move('down');
        expect(focusService.activeGroupId()).toBe('test-bar');
        expect(focusService.activeIndex()).toBe(1);
    });

    it('requests loadMore once focus reaches the last channel', () => {
        focusService.setActive('test-bar', 4);
        fixture.detectChanges();
        expect(host.loadMoreCallCount).toBe(1);
    });

    it('does not request loadMore when the store reports no more content', () => {
        host.hasMore.set(false);
        fixture.detectChanges();

        focusService.setActive('test-bar', 4);
        fixture.detectChanges();

        expect(host.loadMoreCallCount).toBe(0);
    });
});
