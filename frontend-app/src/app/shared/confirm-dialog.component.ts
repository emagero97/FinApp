import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  title = input.required<string>();
  message = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  dangerous = input<boolean>(false);

  confirmed = output<void>();
  dismissed = output<void>();
}
