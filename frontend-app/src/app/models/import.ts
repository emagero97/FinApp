export type ImportRowType = 'income' | 'expense';

export interface ImportRow {
  line: number;
  date: string;
  category: string;
  type: ImportRowType;
  amount: number;
  notes: string | null;
}

export interface InvalidImportRow {
  line: number;
  errors: string[];
}

export interface NewImportCategory {
  name: string;
  type: ImportRowType;
}

export interface ImportSummary {
  month?: string;
  year?: string;
  count: number;
  income: number;
  expenses: number;
  total: number;
}

export interface ImportPreview {
  total: number;
  invalid: number;
  rows: ImportRow[];
  invalid_rows: InvalidImportRow[];
  new_categories: NewImportCategory[];
  summary_months: ImportSummary[];
  summary_years: ImportSummary[];
}

export interface ImportCommitResult {
  inserted: number;
  categories_created: string[];
}