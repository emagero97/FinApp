import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../models/category';
import { Transaction, TransactionType } from '../models/transaction';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-transactions-page',
  imports: [FormsModule, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './transactions-page.component.html',
  styleUrl: './transactions-page.component.css',
})
export class TransactionsPageComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);

  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(false);
  editing = signal<Transaction | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  deleteTarget = signal<Transaction | null>(null);

  readonly form = new FormGroup({
    type: new FormControl<TransactionType>('expense', [Validators.required]),
    category_id: new FormControl<number | null>(null, [Validators.required]),
    date: new FormControl(todayIso(), [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    notes: new FormControl(''),
  });

  constructor() {
    this.categoryService.list().subscribe((res) => this.categories.set(res.categories));
    this.load();
    this.form.controls.type.valueChanges.subscribe(() => {
      if (!this.editing()) {
        this.form.controls.category_id.setValue(null);
      }
    });
  }

  availableCategories(): Category[] {
    const type = this.form.controls.type.value;
    const current = this.editing();
    return this.categories().filter(
      (category) =>
        category.type === type &&
        (category.status === 'enabled' ||
          (current != null && category.id === current.category_id))
    );
  }

  load(): void {
    this.loading.set(true);
    this.transactionService.list().subscribe({
      next: (res) => this.transactions.set(res.transactions),
      error: () => this.transactions.set([]),
      complete: () => this.loading.set(false),
    });
  }

  startCreate(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.reset({
      type: 'expense',
      category_id: null,
      date: todayIso(),
      amount: null,
      notes: '',
    });
  }

  startEdit(transaction: Transaction): void {
    this.editing.set(transaction);
    this.error.set(null);
    this.form.patchValue({
      type: transaction.type,
      category_id: transaction.category_id,
      date: transaction.date,
      amount: Number(transaction.amount),
      notes: transaction.notes ?? '',
    });
  }

  cancelEdit(): void {
    this.startCreate();
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.value;
    const input = {
      type: value.type!,
      category_id: value.category_id!,
      amount: value.amount!,
      date: value.date!,
      notes: value.notes?.trim() ? value.notes.trim() : null,
    };
    const current = this.editing();
    const request = current
      ? this.transactionService.update(current.id, input)
      : this.transactionService.create(input);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.startCreate();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        const message =
          err?.error?.errors?.category_id ??
          err?.error?.errors?.amount ??
          err?.error?.errors?.date ??
          err?.error?.error;
        this.error.set(message ?? 'Something went wrong. Please try again.');
      },
    });
  }

  requestDelete(transaction: Transaction): void {
    this.deleteTarget.set(transaction);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleteTarget.set(null);
    this.transactionService.delete(target.id).subscribe(() => this.load());
  }

  formatAmount(value: string): string {
    return Number(value).toFixed(2);
  }

  isEditing(txId: number): boolean {
    return this.editing()?.id === txId;
  }
}
