import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category } from '../models/category';
import { ExportPeriod, ExportQuery, ExportType } from '../models/export';
import { CategoryService } from '../services/category.service';
import { ExportService } from '../services/export.service';
import { SettingsService } from '../services/settings.service';

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[m - 1]} ${y}`;
}

@Component({
  selector: 'app-export-page',
  imports: [FormsModule],
  templateUrl: './export-page.component.html',
  styleUrl: './export-page.component.css',
})
export class ExportPageComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly exportService = inject(ExportService);
  private readonly settings = inject(SettingsService);

  categories = signal<Category[]>([]);
  period = signal<ExportPeriod>('ALL');
  customFrom = signal('');
  customTo = signal('');
  selectedMonth = signal(this.currentMonth());
  selectedMonths = signal<string[]>([this.currentMonth()]);
  year = signal(new Date().getFullYear());
  type = signal<ExportType>('both');
  included = signal<Set<number>>(new Set());
  preview = signal<number | null>(null);
  loadingPreview = signal(false);
  downloading = signal(false);
  success = signal<string | null>(null);
  error = signal<string | null>(null);

  readonly recentMonths = signal(this.computeRecentMonths());

  constructor() {
    this.categoryService.list().subscribe((res) => {
      this.categories.set(res.categories);
      this.included.set(new Set(res.categories.map((category) => category.id)));
      this.refreshPreview();
    });
  }

  private computeRecentMonths(): string[] {
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  allIncluded(): boolean {
    const cats = this.categories();
    return cats.length > 0 && cats.every((category) => this.included().has(category.id));
  }

  allExcluded(): boolean {
    return this.included().size === 0;
  }

  toggleAllIncluded(): void {
    this.included.set(new Set(this.categories().map((category) => category.id)));
    this.refreshPreview();
  }

  toggleAllExcluded(): void {
    this.included.set(new Set());
    this.refreshPreview();
  }

  toggleCategory(category: Category): void {
    const next = new Set(this.included());
    if (next.has(category.id)) {
      next.delete(category.id);
    } else {
      next.add(category.id);
    }
    this.included.set(next);
    this.refreshPreview();
  }

  toggleMonth(target: Event): void {
    const value = (target as unknown as HTMLInputElement).value;
    const current = new Set(this.selectedMonths());
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    this.selectedMonths.set([...current].sort());
    this.refreshPreview();
  }

  setYear(value: string): void {
    this.year.set(Number(value) || new Date().getFullYear());
    this.refreshPreview();
  }

  onPeriodChange(): void {
    if (this.period() === 'MONTHS' && this.selectedMonths().length === 0) {
      this.selectedMonths.set([this.currentMonth()]);
    }
    this.refreshPreview();
  }

  customRangeInvalid(): boolean {
    return !!(this.customFrom() && this.customTo() && this.customFrom() > this.customTo());
  }

  periodSummary(): string {
    const period = this.period();
    if (period === 'ALL') {
      return this.t('export.periodAll');
    }
    if (period === 'YEAR') {
      return `${this.t('export.periodYear')}: ${this.year()}`;
    }
    if (period === 'MONTH') {
      return `${this.t('export.periodMonth')}: ${this.formatMonth(this.selectedMonth())}`;
    }
    if (period === 'MONTHS') {
      const months = this.selectedMonths().map((month) => this.formatMonth(month));
      return months.join(', ');
    }
    if (this.customFrom() && this.customTo()) {
      return `${this.t('export.periodCustom')}: ${this.customFrom()} → ${this.customTo()}`;
    }
    return this.t('export.periodCustom');
  }

  typeSummary(): string {
    const type = this.type();
    if (type === 'income') {
      return this.t('export.typeIncome');
    }
    if (type === 'expense') {
      return this.t('export.typeExpense');
    }
    return this.t('export.typeBoth');
  }

  buildQuery(): ExportQuery {
    const allCats = this.categories();
    const includedIds = [...this.included()];
    const query: ExportQuery = { type: this.type(), lang: this.settings.language() };
    const period = this.period();
    if (period === 'CUSTOM') {
      query.date_from = this.customFrom();
      query.date_to = this.customTo();
    } else if (period === 'MONTH') {
      query.month = this.selectedMonth();
    } else if (period === 'MONTHS') {
      query.months = this.selectedMonths();
    } else if (period === 'YEAR') {
      query.year = this.year();
    }
    if (includedIds.length > 0 && includedIds.length < allCats.length) {
      query.include_category_ids = allCats
        .filter((category) => this.included().has(category.id))
        .map((category) => category.id);
    }
    return query;
  }

  refreshPreview(): void {
    if (!this.categories().length) {
      return;
    }
    if (this.period() === 'CUSTOM' && this.customRangeInvalid()) {
      this.preview.set(null);
      return;
    }
    this.loadingPreview.set(true);
    this.error.set(null);
    this.exportService.preview(this.buildQuery()).subscribe({
      next: (res) => {
        this.preview.set(res.count);
        this.loadingPreview.set(false);
      },
      error: () => {
        this.preview.set(null);
        this.loadingPreview.set(false);
      },
    });
  }

  download(): void {
    const count = this.preview();
    if (count === null || count === 0) {
      this.error.set(this.t('export.noMatches'));
      return;
    }
    if (this.period() === 'CUSTOM' && this.customRangeInvalid()) {
      return;
    }
    this.downloading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.exportService.download(this.buildQuery()).subscribe({
      next: (response) => {
        this.saveBlob(response.body as Blob, this.filenameFromResponse(response.headers.get('Content-Disposition')));
        this.downloading.set(false);
        this.success.set('export.downloaded');
      },
      error: () => {
        this.downloading.set(false);
        this.error.set(this.t('export.downloadError'));
      },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private filenameFromResponse(disposition: string | null): string {
    if (!disposition) {
      return 'transactions.csv';
    }
    const match = /filename="?([^";]+)"?/.exec(disposition);
    return match?.[1] ?? 'transactions.csv';
  }

  excludedCategories(): Category[] {
    const includedIds = this.included();
    return this.categories().filter((category) => !includedIds.has(category.id));
  }

  formatMonth(month: string): string {
    return monthLabel(month);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }

  isSelectedMonth(month: string): boolean {
    return this.selectedMonths().includes(month);
  }
}