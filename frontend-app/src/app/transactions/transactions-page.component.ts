import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../models/category';
import { Transaction, TransactionQuery, TransactionType } from '../models/transaction';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { SettingsService } from '../services/settings.service';
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
  private readonly settings = inject(SettingsService);

  transactions = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(false);
  editing = signal<Transaction | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  deleteTarget = signal<Transaction | null>(null);
  searchQuery = signal('');
  filterType = signal<string>('');
  filterCategory = signal<number | null>(null);
  filterDateFrom = signal('');
  filterDateTo = signal('');

  readonly form = new FormGroup({
    type: new FormControl<TransactionType>('expense', [Validators.required]),
    category_id: new FormControl<number | null>(null, [Validators.required]),
    subcategory_id: new FormControl<number | null>(null),
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
        this.form.controls.subcategory_id.setValue(null);
      }
    });
    // When the parent category changes, clear the sub-category selection.
    this.form.controls.category_id.valueChanges.subscribe(() => {
      this.form.controls.subcategory_id.setValue(null);
    });
  }

  availableCategories(): Category[] {
    const type = this.form.controls.type.value;
    const current = this.editing();
    return this.categories().filter(
      (category) =>
        category.type === type &&
        (category.status === 'enabled' ||
          (current != null && category.id === current.category_id)) &&
        !category.parent_id // only top-level categories here
    );
  }

  /** Sub-categories (children) of the currently selected top-level category. */
  subcategoriesOfSelected(): Category[] {
    const parentId = this.form.controls.category_id.value;
    if (parentId == null) {
      return [];
    }
    return this.categories().filter((category) => category.parent_id === parentId);
  }

  hasSubcategories(): boolean {
    return this.subcategoriesOfSelected().length > 0;
  }

  load(): void {
    this.loading.set(true);
    const query: TransactionQuery = {};
    const search = this.searchQuery().trim();
    if (this.filterType()) {
      query.type = this.filterType() as TransactionType;
    }
    if (this.filterCategory() != null) {
      query.category_id = this.filterCategory()!;
    }
    if (this.filterDateFrom()) {
      query.date_from = this.filterDateFrom();
    }
    if (this.filterDateTo()) {
      query.date_to = this.filterDateTo();
    }
    if (search) {
      query.search = search;
    }
    this.transactionService.list(query).subscribe({
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
      subcategory_id: null,
      date: todayIso(),
      amount: null,
      notes: '',
    });
  }

  startEdit(transaction: Transaction): void {
    this.editing.set(transaction);
    this.error.set(null);
    const selected = this.categories().find((c) => c.id === transaction.category_id);
    const parentId = selected?.parent_id ?? null;
    const isChild = !!selected?.parent_id;
    this.form.patchValue({
      type: transaction.type,
      category_id: isChild && parentId != null ? parentId : transaction.category_id,
      subcategory_id: isChild ? transaction.category_id : null,
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
    const effectiveCategoryId = value.subcategory_id ?? value.category_id!;
    const input = {
      type: value.type!,
      category_id: effectiveCategoryId,
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

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterType.set('');
    this.filterCategory.set(null);
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.load();
  }

  hasFilters(): boolean {
    return !!(
      this.searchQuery() ||
      this.filterType() ||
      this.filterCategory() != null ||
      this.filterDateFrom() ||
      this.filterDateTo()
    );
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

  /** Full category path, e.g. "Food / Groceries" for a sub-category transaction. */
  categoryPath(transaction: Transaction): string {
    return this.categoryLabel(this.categories().find((c) => c.id === transaction.category_id));
  }

  /** Full path for a category, e.g. "Food / Groceries", or "—" when unknown. */
  categoryLabel(category: Category | undefined): string {
    if (!category) {
      return '—';
    }
    if (category.parent_id != null) {
      const parent = this.categories().find((c) => c.id === category.parent_id);
      return parent ? `${parent.name} / ${category.name}` : category.name;
    }
    return category.name;
  }

  parseCategoryId(value: string): number | null {
    return value === '' ? null : Number(value);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }

  isEditing(txId: number): boolean {
    return this.editing()?.id === txId;
  }
}
