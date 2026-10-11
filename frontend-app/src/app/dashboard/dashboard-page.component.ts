import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { DashboardService } from '../services/dashboard.service';
import { SettingsService } from '../services/settings.service';
import { TransactionService } from '../services/transaction.service';
import { DashboardSummary, PeriodTotals } from '../models/dashboard';
import { Transaction, TransactionQuery } from '../models/transaction';

export type PeriodKey = 'week' | 'month' | 'year';
export type ScopeKey = 'month' | 'year';

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
  monthKey: string;
  label: string;
  year: string;
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
  private readonly transactionService = inject(TransactionService);
  private readonly settings = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  period = signal<PeriodKey>('month');
  selectedMonth = signal<string>(this.currentMonthKey());
  recapScope = signal<ScopeKey>('month');
  recapOpen = signal(false);
  transactionsOpen = signal(false);
  periodTransactions = signal<Transaction[]>([]);
  transactionsLoading = signal(true);
  readonly pageSize = 10;
  txPage = signal(1);
  readonly periodKeys: PeriodKey[] = ['week', 'month', 'year'];
  readonly scopeKeys: ScopeKey[] = ['month', 'year'];

  private readonly requestParams = computed(() => ({
    month: this.selectedMonth(),
    scope: this.recapScope(),
  }));

  /** Date range of the transactions matching the current selection. */
  private readonly transactionRange = computed<TransactionQuery>(() => {
    const [year, month] = this.selectedMonth().split('-');
    const from = this.recapScope() === 'year' ? `${year}-01-01` : `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return {
      date_from: from,
      date_to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  });

  constructor() {
    const sub = toObservable(this.requestParams)
      .pipe(
        switchMap((params) => {
          this.loading.set(true);
          return this.service.get(params).pipe(
            catchError(() => of(null) as Observable<DashboardSummary | null>)
          );
        })
      )
      .subscribe((summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      });

    const txSub = toObservable(this.transactionRange)
      .pipe(
        switchMap((range) => {
          this.transactionsLoading.set(true);
          return this.transactionService.list(range).pipe(
            catchError(() => of(null) as Observable<{ transactions: Transaction[]; total: number } | null>)
          );
        })
      )
      .subscribe((res) => {
        this.periodTransactions.set(res?.transactions ?? []);
        this.txPage.set(1);
        this.transactionsLoading.set(false);
      });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      txSub.unsubscribe();
    });
  }

  setPeriod(period: PeriodKey): void {
    this.period.set(period);
    if (period === 'month' || period === 'year') {
      this.recapScope.set(period);
    }
  }

  setRecapScope(scope: ScopeKey): void {
    this.recapScope.set(scope);
    this.period.set(scope);
  }

  toggleRecap(): void {
    this.recapOpen.update((open) => !open);
  }

  toggleTransactions(): void {
    this.transactionsOpen.update((open) => !open);
  }

  pagedTransactions = computed<Transaction[]>(() => {
    const start = (this.txPage() - 1) * this.pageSize;
    return this.periodTransactions().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.periodTransactions().length / this.pageSize))
  );

  setTxPage(page: number): void {
    this.txPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  selectMonth(monthKey: string): void {
    this.selectedMonth.set(monthKey);
    this.period.set('month');
    this.recapScope.set('month');
  }

  /**
   * Top KPIs follow the current selection: the current week while the week
   * shortcut is active, otherwise the selected month / year-to-date totals.
   */
  kpis(): PeriodTotals {
    if (this.period() === 'week') {
      return this.summary()?.periods.week ?? EMPTY_PERIOD;
    }
    return this.recapTotals();
  }

  kpiSubtitle(): string {
    return this.period() === 'week' ? this.t('dash.currentWeek') : this.recapSubtitle();
  }

  recapTotals(): PeriodTotals {
    return this.summary()?.recap_totals ?? EMPTY_PERIOD;
  }

  currentPeriodLabel(key: PeriodKey): string {
    const suffix = key.charAt(0).toUpperCase() + key.slice(1);
    return this.t('dash.current' + suffix);
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
        monthKey: item.month,
        label: MONTH_NAMES[Number(month) - 1],
        year,
        value: Number(item.balance),
        isCurrent: item.month === this.selectedMonth(),
      };
    });
  });

  /** Scale and zero-baseline used to draw the diverging balance bars. */
  private readonly historyStats = computed(() => {
    const values = this.historyBars().map((bar) => bar.value);
    const maxPositive = Math.max(0, ...values);
    const maxNegative = Math.max(0, ...values.map((value) => -value));
    const range = maxPositive + maxNegative;
    return {
      scale: range > 0 ? range * 1.15 : 1,
      zeroPct: range > 0 ? (maxPositive / range) * 100 : 50,
    };
  });

  historyZeroPct(): number {
    return this.historyStats().zeroPct;
  }

  historyBarHeight(bar: HistoryBar): number {
    return (Math.abs(bar.value) / this.historyStats().scale) * 100;
  }

  historyBarTop(bar: HistoryBar): number {
    const zeroPct = this.historyStats().zeroPct;
    return bar.value >= 0 ? zeroPct - this.historyBarHeight(bar) : zeroPct;
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private selectedMonthParts(): { month: string; year: number } {
    const [year, month] = this.selectedMonth().split('-');
    return { month: MONTH_NAMES[Number(month) - 1], year: Number(year) };
  }

  isCurrentMonthSelected(): boolean {
    return this.selectedMonth() === this.currentMonthKey();
  }

  recapSubtitle(): string {
    if (this.recapScope() === 'year') {
      return this.isCurrentMonthSelected()
        ? this.t('dash.yearToDate')
        : this.t('dash.recapYearNamed', this.selectedMonthParts());
    }
    return this.isCurrentMonthSelected()
      ? this.t('dash.thisMonth')
      : this.t('dash.recapMonthNamed', this.selectedMonthParts());
  }

  monthVsYearsTitle(): string {
    return this.isCurrentMonthSelected()
      ? this.t('dash.monthVsYears')
      : this.t('dash.monthVsYearsSelected', this.selectedMonthParts());
  }

  monthVsYearsSubtitle(): string {
    return this.isCurrentMonthSelected()
      ? this.t('dash.monthVsYearsSub')
      : this.t('dash.monthVsYearsSubSelected', this.selectedMonthParts());
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
