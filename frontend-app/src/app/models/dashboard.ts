export interface PeriodTotals {
  income: string;
  expenses: string;
  balance: string;
}

export interface CategoryBreakdownItem {
  category_id: number;
  name: string;
  color: string | null;
  total: string;
}

export interface CategoryComparisonItem {
  category_id: number;
  name: string;
  color: string | null;
  current: string;
  average: string;
  above_average: boolean;
  difference: string;
}

export interface PreviousYearTotal {
  year: number;
  total: string;
}

export interface MonthComparison {
  year: number;
  month: number;
  current_total: string;
  previous_years: PreviousYearTotal[];
  average_previous: string | null;
}

export interface MonthlyHistoryItem {
  month: string;
  total: string;
}

export interface DashboardSummary {
  periods: {
    week: PeriodTotals;
    month: PeriodTotals;
    year: PeriodTotals;
  };
  category_breakdown: CategoryBreakdownItem[];
  category_comparison: CategoryComparisonItem[];
  month_comparison: MonthComparison;
  monthly_history: MonthlyHistoryItem[];
}
