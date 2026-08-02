import { Component, computed, inject, signal } from '@angular/core';
import { DashboardService } from '../services/dashboard.service';
import { SettingsService } from '../services/settings.service';
import { DashboardSummary, PeriodTotals } from '../models/dashboard';

export type PeriodKey = 'week' | 'month' | 'year';

export interface PieSegment {
  name: string;
  color: string;
  total: number;
  pct: number;
  offsetPct: number;
}

export interface MonthBar {
  label: string;
  value: number;
  isCurrent: boolean;
}

export interface HistoryBar {
  label: string;
  value: number;
  isCurrent: boolean;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY_PERIOD: PeriodTotals = { income: '0.00', expenses: '0.00', balance: '0.00' };
const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

@Component({
  selector: 'app-dashboard-page',
  imports: [],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  private readonly service = inject(DashboardService);
  private readonly settings = inject(SettingsService);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  period = signal<PeriodKey>('month');
  readonly periodKeys: PeriodKey[] = ['week', 'month', 'year'];

  constructor() {
    this.service.get().subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => this.summary.set(null),
      complete: () => this.loading.set(false),
    });
  }

  setPeriod(period: PeriodKey): void {
    this.period.set(period);
  }

  kpis(): PeriodTotals {
    return this.summary()?.periods[this.period()] ?? EMPTY_PERIOD;
  }

  pieSegments = computed<PieSegment[]>(() => {
    const items = this.summary()?.category_breakdown ?? [];
    const total = items.reduce((acc, item) => acc + Number(item.total), 0);
    if (total <= 0) {
      return [];
    }
    let offset = 0;
    return items.map((item) => {
      const pct = (Number(item.total) / total) * 100;
      const segment: PieSegment = {
        name: item.name,
        color: item.color ?? '#94a3b8',
        total: Number(item.total),
        pct,
        offsetPct: offset,
      };
      offset += pct;
      return segment;
    });
  });

  totalExpenses = computed(() =>
    this.pieSegments().reduce((acc, segment) => acc + segment.total, 0)
  );

  comparisonMax = computed(() => {
    const items = this.summary()?.category_comparison ?? [];
    const values = items.flatMap((item) => [Number(item.current), Number(item.average)]);
    return Math.max(1, ...values);
  });

  monthBars = computed<MonthBar[]>(() => {
    const comparison = this.summary()?.month_comparison;
    if (!comparison) {
      return [];
    }
    const bars: MonthBar[] = comparison.previous_years.map((year) => ({
      label: String(year.year),
      value: Number(year.total),
      isCurrent: false,
    }));
    bars.push({
      label: String(comparison.year),
      value: Number(comparison.current_total),
      isCurrent: true,
    });
    return bars;
  });

  monthMax = computed(() => Math.max(1, ...this.monthBars().map((bar) => bar.value)));

  monthAverage = computed<number | null>(() => {
    const average = this.summary()?.month_comparison.average_previous;
    return average === null || average === undefined ? null : Number(average);
  });

  historyBars = computed<HistoryBar[]>(() => {
    const items = this.summary()?.monthly_history ?? [];
    return items.map((item) => {
      const [year, month] = item.month.split('-');
      return {
        label: `${MONTH_NAMES[Number(month) - 1]} ${year.slice(2)}`,
        value: Number(item.total),
        isCurrent: item.month === this.currentMonthKey(),
      };
    });
  });

  historyMax = computed(() => Math.max(1, ...this.historyBars().map((bar) => bar.value)));

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  monthName(): string {
    const comparison = this.summary()?.month_comparison;
    return comparison ? MONTH_NAMES[comparison.month - 1] : '';
  }

  dashArray(segment: PieSegment): string {
    return `${(segment.pct / 100) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`;
  }

  dashOffset(segment: PieSegment): string {
    return `${-(segment.offsetPct / 100) * DONUT_CIRCUMFERENCE}`;
  }

  pctOfComparison(value: string | number): number {
    return (Number(value) / this.comparisonMax()) * 100;
  }

  absMoney(value: string): number {
    return Math.abs(Number(value));
  }

  formatMoney(value: string | number): string {
    return Number(value).toFixed(2);
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.settings.t(key, params);
  }
}
