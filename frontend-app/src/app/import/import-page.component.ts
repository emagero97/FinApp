import { Component, computed, inject, signal } from '@angular/core';
import {
  ImportCategoryAssignment,
  ImportCategoryChoice,
  ImportCategoryOption,
  ImportCommitResult,
  ImportPreview,
  ImportRow,
  ImportRowType,
} from '../models/import';
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

export interface ImportCategoryGroup {
  key: string;
  type: ImportRowType;
  category: string | null;
  notes: string | null;
  rows: ImportRow[];
}

@Component({
  selector: 'app-import-page',
  imports: [],
  templateUrl: './import-page.component.html',
  styleUrl: './import-page.component.css',
})
export class ImportPageComponent {
  private readonly importService = inject(ImportService);
  private readonly settings = inject(SettingsService);

  readonly assignableTypes: ImportRowType[] = ['expense', 'income'];

  pendingFile = signal<File | null>(null);
  selectedFile = signal<{ name: string } | null>(null);
  content = signal<string | null>(null);
  preview = signal<ImportPreview | null>(null);
  result = signal<ImportCommitResult | null>(null);
  choices = signal<Record<string, ImportCategoryChoice | undefined>>({});
  drafts = signal<Record<string, string | undefined>>({});
  reading = signal(false);
  analyzing = signal(false);
  committing = signal(false);
  error = signal<string | null>(null);

  private readonly pendingRowsSignal = computed(() =>
    (this.preview()?.rows ?? []).filter((row) => !row.matched),
  );

  /** Pending rows grouped by transaction type, category found in the file and notes. */
  readonly groups = computed<ImportCategoryGroup[]>(() => {
    const byKey = new Map<string, ImportCategoryGroup>();
    for (const row of this.pendingRowsSignal()) {
      const key = this.groupKey(row);
      const group = byKey.get(key);
      if (group) {
        group.rows.push(row);
      } else {
        byKey.set(key, {
          key,
          type: row.type,
          category: row.category,
          notes: row.notes,
          rows: [row],
        });
      }
    }
    return [...byKey.values()];
  });

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
    this.resetChoices();
  }

  private resetChoices(): void {
    this.choices.set({});
    this.drafts.set({});
  }

  private applySuggestions(): void {
    const suggested = this.groups().filter((group) => group.rows[0].suggested_category_id !== null);
    if (suggested.length === 0) {
      return;
    }
    this.choices.update((current) => {
      const next = { ...current };
      for (const group of suggested) {
        next[group.key] = {
          kind: 'existing',
          categoryId: group.rows[0].suggested_category_id!,
        };
      }
      return next;
    });
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
        this.resetChoices();
        this.applySuggestions();
      },
      error: (err) => {
        this.analyzing.set(false);
        this.preview.set(null);
        this.error.set(this.requestError(err));
      },
    });
  }

  pendingRows(): ImportRow[] {
    return this.pendingRowsSignal();
  }

  categoriesFor(type: ImportRowType): ImportCategoryOption[] {
    return this.preview()?.category_options?.[type] ?? [];
  }

  groupsOfType(type: ImportRowType): ImportCategoryGroup[] {
    return this.groups().filter((group) => group.type === type);
  }

  choiceFor(key: string): ImportCategoryChoice | null {
    return this.choices()[key] ?? null;
  }

  selectedCategoryId(key: string): number | null {
    const choice = this.choiceFor(key);
    return choice?.kind === 'existing' ? choice.categoryId : null;
  }

  categoryOptionLabel(option: ImportCategoryOption, group: ImportCategoryGroup): string {
    return option.id === group.rows[0].suggested_category_id
      ? `${option.name} (${this.t('imp.suggested')})`
      : option.name;
  }

  assignedCategoryName(key: string): string | null {
    const choice = this.choiceFor(key);
    if (!choice) {
      return null;
    }
    if (choice.kind === 'new') {
      return choice.name;
    }
    const group = this.groupByKey(key);
    const options = this.categoriesFor(group?.type ?? 'expense');
    return options.find((item) => item.id === choice.categoryId)?.name ?? null;
  }

  setExistingChoice(key: string, value: string): void {
    this.choices.update((current) => ({
      ...current,
      [key]: value === '' ? undefined : { kind: 'existing', categoryId: Number(value) },
    }));
    this.drafts.update((current) => ({ ...current, [key]: '' }));
  }

  setDraft(key: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [key]: value }));
  }

  draftFor(key: string): string {
    return this.drafts()[key] ?? '';
  }

  confirmNewChoice(key: string): void {
    const name = this.draftFor(key).trim();
    if (!name) {
      return;
    }
    this.choices.update((current) => ({ ...current, [key]: { kind: 'new', name } }));
  }

  clearChoice(key: string): void {
    this.choices.update((current) => ({ ...current, [key]: undefined }));
    this.drafts.update((current) => ({ ...current, [key]: '' }));
  }

  applyExistingToAll(type: ImportRowType, value: string): void {
    const groups = this.groupsOfType(type);
    const categoryId = Number(value);
    if (groups.length === 0 || !value) {
      return;
    }
    this.choices.update((current) => {
      const next = { ...current };
      for (const group of groups) {
        next[group.key] = { kind: 'existing', categoryId };
      }
      return next;
    });
  }

  /** Transactions that still have no category, counting every row of an unresolved group. */
  unassignedCount(): number {
    return this.groups().reduce(
      (total, group) => total + (this.choiceFor(group.key) ? 0 : group.rows.length),
      0,
    );
  }

  assignments(): ImportCategoryAssignment[] {
    return this.groups().flatMap((group) => {
      const choice = this.choiceFor(group.key);
      if (!choice) {
        return [];
      }
      return group.rows.map((row) =>
        choice.kind === 'existing'
          ? { line: row.line, category_id: choice.categoryId }
          : { line: row.line, category: choice.name },
      );
    });
  }

  fileCategoryLabel(category: string): string {
    return this.t('imp.assignFileCategory', { name: category });
  }

  groupLinesLabel(group: ImportCategoryGroup): string {
    const lines = group.rows.map((row) => row.line);
    return lines.length === 1
      ? this.t('imp.line', { line: lines[0] })
      : this.t('imp.lines', { lines: lines.join(', ') });
  }

  groupCountLabel(group: ImportCategoryGroup): string {
    return this.t('imp.groupCount', { count: group.rows.length });
  }

  groupTotal(group: ImportCategoryGroup): number {
    return group.rows.reduce((total, row) => total + row.amount, 0);
  }

  groupDatesLabel(group: ImportCategoryGroup): string {
    const dates = group.rows.map((row) => row.date).sort();
    return dates.length === 1 ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`;
  }

  private groupKey(row: ImportRow): string {
    if (!row.category && !row.notes) {
      return `line:${row.line}`;
    }
    return [row.type, row.category ?? '', row.notes ?? ''].join('\u0000');
  }

  private groupByKey(key: string): ImportCategoryGroup | undefined {
    return this.groups().find((group) => group.key === key);
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
    return this.unassignedCount() === 0;
  }

  confirmImport(): void {
    const content = this.content();
    if (!content || !this.canImport()) {
      return;
    }
    this.committing.set(true);
    this.error.set(null);
    this.result.set(null);
    this.importService.commit(content, this.assignments()).subscribe({
      next: (res) => {
        this.committing.set(false);
        this.result.set(res);
        this.preview.set(null);
        this.pendingFile.set(null);
        this.selectedFile.set(null);
        this.content.set(null);
        this.resetChoices();
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

  typeLabel(type: ImportRowType): string {
    return this.t(type === 'income' ? 'imp.typeIncome' : 'imp.typeExpense');
  }

  applyToAllLabel(type: ImportRowType): string {
    return this.t('imp.applyToAll', { type: this.typeLabel(type) });
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
    return errors['content'] ?? errors['category'] ?? errors['assignments'] ?? fallback;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }
}