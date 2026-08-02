import { Component, inject, signal } from '@angular/core';
import { Category, CategoryStatus, CategoryType } from '../models/category';
import { CategoryService } from '../services/category.service';
import { SettingsService } from '../services/settings.service';
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
  private readonly settings = inject(SettingsService);

  categories = signal<Category[]>([]);
  loading = signal(false);
  topLevel = signal<Category[]>([]);
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

  childrenOf(category: Category): Category[] {
    return this.categories().filter((c) => c.parent_id === category.id);
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
        next: (res) => {
          this.categories.set(res.categories);
          this.topLevel.set(res.categories.filter((c) => !c.parent_id));
        },
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
      title: disabling ? this.t('cat.disableTitle') : this.t('cat.enableTitle'),
      message:
        disabling && category.transaction_count > 0
          ? this.t('cat.disableWarn', { count: category.transaction_count })
          : '',
      confirmLabel: disabling ? this.t('cat.disable') : this.t('cat.enable'),
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
    if (category.transaction_count > 0 || category.child_count > 0) {
      this.blockedDelete.set(category);
      return;
    }
    this.confirmState.set({
      title: this.t('cat.deleteTitle'),
      message: this.t('cat.deleteConfirm', { name: category.name }),
      confirmLabel: this.t('cat.delete'),
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

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }

  blockMessage(category: Category): string {
    if (category.child_count > 0) {
      return this.t('cat.deleteChildrenMsg', {
        count: category.child_count,
        sub: category.child_count === 1 ? this.t('cat.subcategory') : this.t('cat.subcategories'),
      });
    }
    return this.t('cat.deleteLinkedMsg', { count: category.transaction_count });
  }
}
