export type ExportPeriod = 'ALL' | 'YEAR' | 'MONTH' | 'MONTHS' | 'CUSTOM';
export type ExportType = 'income' | 'expense' | 'both';

export interface ExportQuery {
  type?: ExportType;
  date_from?: string;
  date_to?: string;
  month?: string;
  months?: string[];
  year?: number;
  include_category_ids?: number[];
  exclude_category_ids?: number[];
  lang?: string;
}

export interface ExportPreview {
  count: number;
}