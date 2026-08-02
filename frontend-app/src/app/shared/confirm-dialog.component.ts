import { Component, inject, input, output } from '@angular/core';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  private readonly settings = inject(SettingsService);

  title = input.required<string>();
  message = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  dangerous = input<boolean>(false);

  confirmed = output<void>();
  dismissed = output<void>();

  t(key: string): string {
    return this.settings.t(key);
  }
}
