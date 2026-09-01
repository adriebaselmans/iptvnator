import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
    TvFocusableDirective,
    TvFocusGroupDirective,
    type FocusGroupNeighbours,
} from '@iptvnator/ui/tv-navigation';
import {
    buildTvKeyboardKeys,
    TV_KEYBOARD_COLUMN_COUNT,
    type TvKeyboardKey,
} from './tv-keyboard.util';

/**
 * The search screen's on-screen keyboard (§7.6): the remote has no text
 * entry at all, so this is the only way to type. It is a fixed-column `grid`
 * focus group — the exact same index arithmetic as the movies/series poster
 * grid, no special case — wired directly in the template (like the catalogue
 * state's retry group) rather than through `hostDirectives`, because the
 * column count here is a constant the component owns, not something a caller
 * ever overrides.
 */
@Component({
    selector: 'lib-tv-keyboard',
    imports: [TvFocusableDirective, TvFocusGroupDirective, TranslateModule],
    templateUrl: './tv-keyboard.component.html',
    styleUrl: './tv-keyboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'tv-keyboard',
    },
})
export class TvKeyboardComponent {
    readonly focusGroupId = input.required<string>();
    readonly neighbours = input<FocusGroupNeighbours>({});

    readonly charEntered = output<string>();
    readonly backspacePressed = output<void>();
    readonly cleared = output<void>();

    protected readonly keys: readonly TvKeyboardKey[] = buildTvKeyboardKeys();
    protected readonly columnCount = TV_KEYBOARD_COLUMN_COUNT;

    protected onKeyActivated(key: TvKeyboardKey): void {
        switch (key.kind) {
            case 'char':
            case 'space':
                this.charEntered.emit(key.value ?? '');
                break;
            case 'backspace':
                this.backspacePressed.emit();
                break;
            case 'clear':
                this.cleared.emit();
                break;
        }
    }
}
