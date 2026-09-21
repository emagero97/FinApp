import { Component, inject, signal } from '@angular/core';
import { ImportCommitResult, ImportPreview, NewImportCategory } from '../models/import';
import { ImportService } from '../services/import.service';
import { SettingsService } from '../services/settings.service';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

@Component({
  selector: 'app-import-page',
  imports: [],
  templateUrl: './import-page.component.html',
  styleUrl: './import-page.component.css',
})
export class ImportPageComponent {
  private readonly importService = inject(ImportService);
  private readonly settings = inject(SettingsService);

  pendingFile = signal<File | null>(null);
  selectedFile = signal<{ name: string } | null>(null);
  content = signal<string | null>(null);
  preview = signal<ImportPreview | null>(null);
  result = signal<ImportCommitResult | null>(null);
  createCategories = signal(true);
  reading = signal(false);
  analyzing = signal(false);
  committing = signal(false);
  error = signal<string | null>(null);

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.pendingFile.set(file);
    this.selectedFile.set({ name: file.name });
    this.content.set(null);
    this.preview.set(null);
    this.result.set(null);
    this.error.set(null);
    this.createCategories.set(true);
  }

  runPreview(input?: HTMLInputElement): void {
    if (this.processing()) {
      return;
    }

    const pendingContent = this.content();
    if (pendingContent !== null) {
      this.startPreview(pendingContent);
      return;
    }

    let file = this.pendingFile();
    if (!file && input) {
      file = input.files?.[0] ?? null;
    }
    if (!file) {
      this.error.set(this.t('imp.noFile'));
      return;
    }
    this.pendingFile.set(file);
    this.reading.set(true);
    this.error.set(null);
    this.result.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      this.reading.set(false);
      this.startPreview(content);
    };
    reader.onerror = () => {
      this.reading.set(false);
      this.error.set(this.t('imp.readError'));
    };
    reader.readAsText(file);
  }

  private startPreview(content: string): void {
    this.content.set(content);
    this.analyzing.set(true);
    this.importService.preview(content).subscribe({
      next: (res) => {
        this.analyzing.set(false);
        this.preview.set(res);
      },
      error: (err) => {
        this.analyzing.set(false);
        this.preview.set(null);
        this.error.set(this.requestError(err));
      },
    });
  }

  processing(): boolean {
    return this.reading() || this.analyzing();
  }

  statusText(): string | null {
    if (this.reading()) {
      return this.t('imp.reading');
    }
    if (this.analyzing()) {
      return this.t('imp.analyzing');
    }
    return null;
  }

  canImport(): boolean {
    const preview = this.preview();
    if (!preview || this.processing() || this.committing()) {
      return false;
    }
    if (preview.total === 0) {
      return false;
    }
    if (preview.new_categories.length > 0 && !this.createCategories()) {
      return false;
    }
    return true;
  }

  confirmImport(): void {
    const content = this.content();
    if (!content || !this.canImport()) {
      return;
    }
    this.committing.set(true);
    this.error.set(null);
    this.result.set(null);
    this.importService.commit(content, this.createCategories()).subscribe({
      next: (res) => {
        this.committing.set(false);
        this.result.set(res);
        this.preview.set(null);
        this.pendingFile.set(null);
        this.selectedFile.set(null);
        this.content.set(null);
      },
      error: (err) => {
        this.committing.set(false);
        this.error.set(this.requestError(err));
      },
    });
  }

  formatMonth(month: string): string {
    const [year, value] = month.split('-').map(Number);
    const names = this.settings.language() === 'it' ? MONTH_NAMES_IT : MONTH_NAMES_EN;
    return `${names[value - 1]} ${year}`;
  }

  formatAmount(value: number): string {
    const sign = value < 0 ? '-' : '';
    return `${sign}${Math.abs(value).toFixed(2)}`;
  }

  categoryType(category: NewImportCategory): string {
    return this.t(category.type === 'income' ? 'imp.typeIncome' : 'imp.typeExpense');
  }

  successParams(result: ImportCommitResult): Record<string, string | number> {
    return { inserted: result.inserted, created: result.categories_created.length };
  }

  private requestError(err: unknown): string {
    const errors = (err as { error?: { errors?: Record<string, string> } })?.error?.errors;
    const fallback = this.t('imp.error');
    if (!errors) {
      return fallback;
    }
    return errors['content'] ?? errors['category'] ?? errors['create_categories'] ?? fallback;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }
}