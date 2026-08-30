import { CommonModule } from '@angular/common';
import { Component, input, ViewEncapsulation } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Settings > TV (§5.3 of the TV shell design). One toggle: whether the app
 * should open straight into the `/tv` 10-foot shell on startup instead of
 * the desktop workspace. The `--tv` CLI flag and kiosk mode are launch-time
 * concerns with no settings UI of their own.
 */
@Component({
    selector: 'app-settings-tv-section',
    imports: [
        CommonModule,
        MatCheckboxModule,
        MatIconModule,
        ReactiveFormsModule,
        TranslateModule,
    ],
    templateUrl: './settings-tv-section.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: [':host { display: contents; }'],
})
export class SettingsTvSectionComponent {
    readonly form = input.required<FormGroup>();
}
