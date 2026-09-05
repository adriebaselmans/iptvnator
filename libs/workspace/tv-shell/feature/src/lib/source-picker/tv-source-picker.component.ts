import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    signal,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { isXtreamAccountPlaylist, PlaylistMeta } from '@iptvnator/shared/interfaces';
import { PlaylistActions, selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    TvFocusService,
    type FocusGroupNeighbours,
} from '@iptvnator/ui/tv-navigation';
import { TvKeyboardComponent } from '@iptvnator/workspace/tv-shell/ui';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, map } from 'rxjs';
import {
    buildTvAddSourcePlaylist,
    canAdvanceWizardStep,
    nextTvAddSourceWizardStep,
    previousTvAddSourceWizardStep,
    type TvAddSourceWizardStep,
} from './tv-add-source-wizard.util';

type XtreamAccountPlaylistMeta = PlaylistMeta & {
    serverUrl: string;
    username: string;
    password: string;
};

const SOURCE_CARDS_GROUP_ID = 'tv-source-picker';
const WIZARD_KEYBOARD_GROUP_ID = 'tv-source-picker-wizard-keyboard';
const WIZARD_ACTIONS_GROUP_ID = 'tv-source-picker-wizard-actions';

/**
 * `/tv` — lists Xtream sources as focusable cards (§7.1). With exactly one
 * Xtream source, redirects straight to its home screen so a single-source
 * household never has to pick.
 *
 * Also hosts an inline "Add Xtream source" wizard (no new route — the whole
 * flow is three on-screen-keyboard steps swapped in place, same pattern as
 * the search screen's keyboard): Server URL, Username, Password, then
 * Connect persists the playlist and jumps to its home screen. Persistence
 * goes through `PlaylistsService.addPlaylist()` directly rather than
 * dispatching `PlaylistActions.addPlaylist` (the desktop import dialog's
 * path) — that action's effect also navigates to `/workspace/xtreams/:id`
 * on success, which would kick the user out of TV mode the moment the
 * source finished saving. `PlaylistActions.loadPlaylists()` afterwards
 * syncs NgRx state from the same source `loadPlaylistsSuccess` uses,
 * without that side effect.
 */
@Component({
    selector: 'lib-tv-source-picker',
    imports: [
        RouterLink,
        TranslateModule,
        TvFocusGroupDirective,
        TvFocusableDirective,
        TvKeyboardComponent,
    ],
    templateUrl: './tv-source-picker.component.html',
    styleUrl: './tv-source-picker.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvSourcePickerComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly focusService = inject(TvFocusService);
    private readonly playlistsService = inject(PlaylistsService);

    protected readonly groupId = SOURCE_CARDS_GROUP_ID;
    protected readonly wizardKeyboardGroupId = WIZARD_KEYBOARD_GROUP_ID;
    protected readonly wizardActionsGroupId = WIZARD_ACTIONS_GROUP_ID;
    protected readonly wizardKeyboardNeighbours: FocusGroupNeighbours = {
        down: WIZARD_ACTIONS_GROUP_ID,
    };
    protected readonly wizardActionsNeighbours: FocusGroupNeighbours = {
        up: WIZARD_KEYBOARD_GROUP_ID,
    };

    readonly xtreamSources = toSignal(
        this.store.select(selectAllPlaylistsMeta).pipe(
            map((playlists) => playlists.filter(isXtreamAccountPlaylist))
        ),
        { initialValue: [] as XtreamAccountPlaylistMeta[] }
    );

    protected readonly wizardStep = signal<TvAddSourceWizardStep>('idle');
    protected readonly serverUrlInput = signal('');
    protected readonly usernameInput = signal('');
    protected readonly passwordInput = signal('');
    protected readonly showValidationError = signal(false);
    protected readonly connectFailed = signal(false);

    protected readonly currentInputValue = computed(() => {
        switch (this.wizardStep()) {
            case 'url':
                return this.serverUrlInput();
            case 'username':
                return this.usernameInput();
            case 'password':
                return '•'.repeat(this.passwordInput().length);
            default:
                return '';
        }
    });

    protected readonly canAdvance = computed(() =>
        canAdvanceWizardStep(this.wizardStep(), {
            serverUrl: this.serverUrlInput(),
            username: this.usernameInput(),
            password: this.passwordInput(),
        })
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
        //
        // A single source used to skip this (it redirects instead), but the
        // "Add source" card now means the group always has at least one
        // focusable item even at zero sources, so only the exactly-one
        // (redirecting) case is excluded.
        effect(() => {
            if (this.hasSetInitialFocus) return;
            if (this.xtreamSources().length === 1) return;
            this.hasSetInitialFocus = true;
            untracked(() => {
                queueMicrotask(() =>
                    this.focusService.setActive(SOURCE_CARDS_GROUP_ID, 0)
                );
            });
        });

        // Entering the wizard, or moving between its steps, always starts
        // the user back on the keyboard's first key — same
        // `queueMicrotask`-past-`ngOnInit` reasoning as above, needed here
        // because the very first entry (idle -> url) mounts the keyboard
        // for the first time.
        effect(() => {
            const step = this.wizardStep();
            if (step === 'idle' || step === 'connecting') {
                return;
            }
            untracked(() => {
                queueMicrotask(() =>
                    this.focusService.setActive(WIZARD_KEYBOARD_GROUP_ID, 0)
                );
            });
        });
    }

    sourceLabel(source: PlaylistMeta): string {
        return source.title || source.filename || source._id;
    }

    protected onAddSourceActivated(): void {
        this.serverUrlInput.set('');
        this.usernameInput.set('');
        this.passwordInput.set('');
        this.showValidationError.set(false);
        this.connectFailed.set(false);
        this.wizardStep.set('url');
    }

    protected onWizardCharEntered(char: string): void {
        this.showValidationError.set(false);
        this.updateCurrentInput((current) => current + char);
    }

    protected onWizardBackspace(): void {
        this.updateCurrentInput((current) => current.slice(0, -1));
    }

    protected onWizardCleared(): void {
        this.updateCurrentInput(() => '');
    }

    protected onWizardNext(): void {
        const step = this.wizardStep();
        if (step === 'password') {
            void this.onConnect();
            return;
        }
        if (!this.canAdvance()) {
            this.showValidationError.set(true);
            return;
        }
        this.showValidationError.set(false);
        this.wizardStep.set(nextTvAddSourceWizardStep(step));
    }

    protected onWizardBack(): void {
        const previous = previousTvAddSourceWizardStep(this.wizardStep());
        this.showValidationError.set(false);
        this.connectFailed.set(false);
        this.wizardStep.set(previous);
        if (previous === 'idle') {
            // The "Add source" card is always the last item in the group.
            const index = this.xtreamSources().length;
            queueMicrotask(() =>
                this.focusService.setActive(SOURCE_CARDS_GROUP_ID, index)
            );
        }
    }

    protected async onConnect(): Promise<void> {
        if (!this.canAdvance()) {
            this.showValidationError.set(true);
            return;
        }
        this.showValidationError.set(false);
        this.connectFailed.set(false);
        this.wizardStep.set('connecting');

        const playlist = buildTvAddSourcePlaylist({
            serverUrl: this.serverUrlInput(),
            username: this.usernameInput(),
            password: this.passwordInput(),
        });

        try {
            await firstValueFrom(this.playlistsService.addPlaylist(playlist));
            // Refreshes NgRx state the same way `loadPlaylists$` always
            // does, without the `addPlaylist$` effect's side effect of
            // navigating to the desktop `/workspace/xtreams/:id` route.
            this.store.dispatch(PlaylistActions.loadPlaylists());
            await this.router.navigate([
                '/tv/xtreams',
                playlist._id,
                'home',
            ]);
        } catch {
            this.connectFailed.set(true);
            this.wizardStep.set('password');
        }
    }

    private updateCurrentInput(update: (current: string) => string): void {
        switch (this.wizardStep()) {
            case 'url':
                this.serverUrlInput.update(update);
                break;
            case 'username':
                this.usernameInput.update(update);
                break;
            case 'password':
                this.passwordInput.update(update);
                break;
        }
    }
}
