import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { isXtreamAccountPlaylist, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    TvFocusService,
} from '@iptvnator/ui/tv-navigation';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';

type XtreamAccountPlaylistMeta = PlaylistMeta & {
    serverUrl: string;
    username: string;
    password: string;
};

const SOURCE_CARDS_GROUP_ID = 'tv-source-picker';

/**
 * `/tv` — lists Xtream sources as focusable cards (§7.1). With exactly one
 * Xtream source, redirects straight to its home screen so a single-source
 * household never has to pick.
 */
@Component({
    selector: 'lib-tv-source-picker',
    imports: [
        RouterLink,
        TranslateModule,
        TvFocusGroupDirective,
        TvFocusableDirective,
    ],
    templateUrl: './tv-source-picker.component.html',
    styleUrl: './tv-source-picker.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvSourcePickerComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly focusService = inject(TvFocusService);

    protected readonly groupId = SOURCE_CARDS_GROUP_ID;

    readonly xtreamSources = toSignal(
        this.store.select(selectAllPlaylistsMeta).pipe(
            map((playlists) => playlists.filter(isXtreamAccountPlaylist))
        ),
        { initialValue: [] as XtreamAccountPlaylistMeta[] }
    );

    private hasSetInitialFocus = false;

    constructor() {
        effect(() => {
            const sources = this.xtreamSources();
            if (sources.length !== 1) {
                return;
            }

            const [only] = sources;
            untracked(() => {
                void this.router.navigate(['/tv/xtreams', only._id, 'home']);
            });
        });

        // Correction #17: with more than one source the screen never
        // redirects, so nothing is ever focused unless this effect does it —
        // `TvFocusService.move()`/`activateFocusedElement()` both no-op while
        // `activeGroupId()` is null. The cards register from their own
        // `ngOnInit`, which the *first* effect flush always races: Angular
        // flushes effects before change detection runs
        // (`ComponentFixture.detectChanges()`/`ApplicationRef.tick()`), so on
        // the very first flush the cards have not rendered yet even when
        // `xtreamSources()` already resolved synchronously (the common case
        // for a store selector). `queueMicrotask` defers the actual
        // `setActive()` call past that synchronous change-detection pass,
        // by which time the group is registered.
        effect(() => {
            if (this.hasSetInitialFocus) return;
            if (this.xtreamSources().length < 2) return;
            this.hasSetInitialFocus = true;
            untracked(() => {
                queueMicrotask(() =>
                    this.focusService.setActive(SOURCE_CARDS_GROUP_ID, 0)
                );
            });
        });
    }

    sourceLabel(source: PlaylistMeta): string {
        return source.title || source.filename || source._id;
    }
}
