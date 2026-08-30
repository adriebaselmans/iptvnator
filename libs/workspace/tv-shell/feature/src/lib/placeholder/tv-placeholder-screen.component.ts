import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';

/**
 * Stand-in for the routed TV screens that later phases build (§13):
 * `home`/`search`/`discover` land in Phase 6, `movies`/`series`/`detail` in
 * Phase 3, `live` in Phase 5. This component only exists so the `/tv` route
 * subtree resolves in Phase 2 — it renders no navigable content of its own
 * and must not be mistaken for a finished screen.
 *
 * The screen name comes from route `data.tvScreen`, set per-route in
 * `tv-shell.routes.ts`.
 */
@Component({
    selector: 'lib-tv-placeholder-screen',
    imports: [TranslateModule],
    templateUrl: './tv-placeholder-screen.component.html',
    styleUrl: './tv-placeholder-screen.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPlaceholderScreenComponent {
    private readonly route = inject(ActivatedRoute);

    readonly screenName = toSignal(
        this.route.data.pipe(
            map((data) => (data['tvScreen'] as string | undefined) ?? '')
        ),
        { initialValue: '' }
    );
}
