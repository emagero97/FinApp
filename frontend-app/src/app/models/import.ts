export type ImportRowType = 'income' | 'expense';

export interface ImportRow {
  line: number;
  date: string;
  category: string | null;
  matched: boolean;
  suggested_category_id: number | null;
  type: ImportRowType;
  amount: number;
  notes: string | null;
}

export interface InvalidImportRow {
  line: number;
  errors: string[];
}

export interface ImportCategoryOption {
  id: number;
  name: string;
}

export type ImportCategoryChoice =
  | { kind: 'existing'; categoryId: number }
  | { kind: 'new'; name: string };

export interface ImportCategoryAssignment {
  line: number;
  category_id?: number;
  category?: string;
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
  pending: number;
  resolved: number;
  rows: ImportRow[];
  invalid_rows: InvalidImportRow[];
  summary_months: ImportSummary[];
  summary_years: ImportSummary[];
  category_options: Record<ImportRowType, ImportCategoryOption[]>;
}

export interface ImportCommitResult {
  inserted: number;
  categories_created: string[];
}