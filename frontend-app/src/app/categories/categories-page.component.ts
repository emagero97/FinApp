import { Component, inject, signal } from '@angular/core';
import { Category, CategoryStatus, CategoryType } from '../models/category';
import { CategoryService } from '../services/category.service';
import { CategoryFormComponent } from './category-form.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  dangerous: boolean;
  onConfirm: () => void;
}

@Component({
  selector: 'app-categories-page',
  imports: [CategoryFormComponent, ConfirmDialogComponent],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.css',
})
export class CategoriesPageComponent {
  private readonly service = inject(CategoryService);

  categories = signal<Category[]>([]);
  loading = signal(false);
  search = signal('');
  typeFilter = signal<CategoryType | ''>('');
  statusFilter = signal<CategoryStatus | ''>('');
  sortBy = signal('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  showForm = signal(false);
  editing = signal<Category | null>(null);
  confirmState = signal<ConfirmState | null>(null);
  blockedDelete = signal<Category | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service
      .list({
        search: this.search(),
        type: this.typeFilter() || undefined,
        status: this.statusFilter() || undefined,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
      })
      .subscribe({
        next: (res) => this.categories.set(res.categories),
        error: () => this.categories.set([]),
        complete: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  openEdit(category: Category): void {
    this.editing.set(category);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editing.set(null);
  }

  onSaved(): void {
    this.closeForm();
    this.load();
  }

  toggleStatus(category: Category): void {
    const disabling = category.status === 'enabled';
    this.confirmState.set({
      title: disabling ? 'Disable category?' : 'Enable category?',
      message:
        disabling && category.transaction_count > 0
          ? `This category is linked to ${category.transaction_count} transactions. Disabling it will not remove historical data; it will only prevent it from being used for new transactions.`
          : '',
      confirmLabel: disabling ? 'Disable' : 'Enable',
      dangerous: disabling,
      onConfirm: () => {
        const nextStatus: CategoryStatus = disabling ? 'disabled' : 'enabled';
        this.service
          .update(category.id, { ...category, status: nextStatus })
          .subscribe(() => this.load());
      },
    });
  }

  requestDelete(category: Category): void {
    if (category.transaction_count > 0) {
      this.blockedDelete.set(category);
      return;
    }
    this.confirmState.set({
      title: 'Delete category?',
      message: `Are you sure you want to permanently delete "${category.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      dangerous: true,
      onConfirm: () => this.service.delete(category.id).subscribe(() => this.load()),
    });
  }

  closeConfirm(): void {
    this.confirmState.set(null);
    this.blockedDelete.set(null);
  }

  runConfirm(): void {
    this.confirmState()?.onConfirm();
    this.confirmState.set(null);
  }

  formatAmount(value: string): string {
    return Number(value).toFixed(2);
  }

  formatDate(value: string | null): string {
    return value ?? '—';
  }
}
