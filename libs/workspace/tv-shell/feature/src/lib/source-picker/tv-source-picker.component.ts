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
import { TvFocusableDirective, TvFocusGroupDirective } from '@iptvnator/ui/tv-navigation';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';

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

    readonly xtreamSources = toSignal(
        this.store.select(selectAllPlaylistsMeta).pipe(
            map((playlists) => playlists.filter(isXtreamAccountPlaylist))
        ),
        { initialValue: [] as PlaylistMeta[] }
    );

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
    }

    sourceLabel(source: PlaylistMeta): string {
        return source.title || source.filename || source._id;
    }
}
