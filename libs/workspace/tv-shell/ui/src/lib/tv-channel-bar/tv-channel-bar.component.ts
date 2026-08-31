import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    TvFocusService,
} from '@iptvnator/ui/tv-navigation';

/** One entry in the channel bar's vertical list (§7.3). */
export interface TvChannelBarItem {
    readonly id: number;
    readonly name: string;
    readonly logoUrl?: string;
}

/** The highlighted channel's current programme, shown beside the list. */
export interface TvChannelBarProgramme {
    readonly title: string;
    readonly startMs: number;
    readonly stopMs: number;
}

/**
 * The live TV channel bar (§7.3, opened by OK over the video): a vertical
 * list of channels, with the highlighted channel's current programme shown
 * beside it. The caller must pass `orientation="column"` (forwarded, like
 * `TvCategoryRailComponent`, rather than hardcoded, so a unit test can mount
 * it standalone) — without it, Up/Down would exit the group instead of
 * moving within it, since the focus group directive defaults to `row`.
 * Up/Down move within the list (ordinary
 * focus movement, nothing special here); OK tunes via `channelActivated`
 * (each row is a real focusable button — §6.4 "no hidden actions"); Left/Right
 * exit the group toward the category column / EPG grid through the ordinary
 * focus graph (`neighbours`, forwarded like every other TV focus group) —
 * this component has no bespoke Left/Right handling of its own.
 *
 * Presentational only: which channel is playing, which programme is shown,
 * and what activating a row does are all owned by the routed live screen.
 * Mirrors `TvPosterGridComponent`'s focus-driven `loadMore` (§8.2) so a
 * category with many channels does not force the caller to render them all
 * at once.
 */
@Component({
    selector: 'lib-tv-channel-bar',
    imports: [TvFocusableDirective],
    hostDirectives: [
        {
            directive: TvFocusGroupDirective,
            inputs: ['tvFocusGroup', 'orientation', 'neighbours'],
        },
    ],
    templateUrl: './tv-channel-bar.component.html',
    styleUrl: './tv-channel-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'tv-channel-bar' },
})
export class TvChannelBarComponent {
    private readonly focusService = inject(TvFocusService);
    private readonly group = inject(TvFocusGroupDirective, { self: true });

    readonly channels = input.required<readonly TvChannelBarItem[]>();
    readonly playingChannelId = input<number | null>(null);
    readonly highlightedProgramme = input<TvChannelBarProgramme | null>(null);
    readonly noProgrammeLabel = input('');
    readonly hasMore = input(false);
    readonly appending = input(false);

    readonly channelActivated = output<TvChannelBarItem>();
    readonly loadMoreRequested = output<void>();

    constructor() {
        effect(() => {
            if (this.focusService.activeGroupId() !== this.group.id) {
                return;
            }
            const itemCount = this.channels().length;
            if (itemCount === 0 || this.appending() || !this.hasMore()) {
                return;
            }
            if (this.focusService.activeIndex() >= itemCount - 1) {
                this.loadMoreRequested.emit();
            }
        });
    }

    protected trackById(_index: number, item: TvChannelBarItem): number {
        return item.id;
    }
}
