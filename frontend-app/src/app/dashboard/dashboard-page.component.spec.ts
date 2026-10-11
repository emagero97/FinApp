import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DashboardPageComponent } from './dashboard-page.component';
import { DashboardService } from '../services/dashboard.service';
import { TransactionService } from '../services/transaction.service';
import { DashboardSummary } from '../models/dashboard';

function sampleSummary(): DashboardSummary {
  return {
    periods: {
      week: { income: '0.00', expenses: '0.00', balance: '0.00' },
      month: { income: '2500.00', expenses: '620.00', balance: '1880.00' },
      year: { income: '2500.00', expenses: '650.00', balance: '1850.00' },
    },
    recap_totals: { income: '2500.00', expenses: '620.00', balance: '1880.00' },
    category_breakdown: [
      { category_id: 1, name: 'Rent', color: '#ef4444', total: '500.00' },
      { category_id: 2, name: 'Groceries', color: '#f59e0b', total: '120.00' },
    ],
    category_comparison: [
      {
        category_id: 2,
        name: 'Groceries',
        color: '#f59e0b',
        current: '120.00',
        average: '85.00',
        above_average: true,
        difference: '35.00',
      },
    ],
    month_comparison: {
      year: 2026,
      month: 7,
      current_total: '620.00',
      previous_years: [{ year: 2025, total: '50.00' }],
      average_previous: '50.00',
    },
    monthly_history: [
      { month: '2026-07', balance: '1880.00' },
      { month: '2026-06', balance: '-30.00' },
    ],
  };
}

describe('DashboardPageComponent', () => {
  let service: { get: ReturnType<typeof vi.fn> };
  let transactionService: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const base = sampleSummary();
    service = {
      get: vi
        .fn()
        .mockImplementation((filters?: { scope?: string }) =>
          of(
            filters?.scope === 'year'
              ? {
                  ...base,
                  recap_totals: { income: '2500.00', expenses: '650.00', balance: '1850.00' },
                }
              : base
          )
        ),
    };
    transactionService = { list: vi.fn().mockReturnValue(of({ transactions: [], total: 0 })) };
    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideHttpClient(),
        { provide: DashboardService, useValue: service },
        { provide: TransactionService, useValue: transactionService },
      ],
    });
  });

  it('should render the month KPIs by default', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1880.00');
    expect(el.textContent).toContain('2500.00');
    expect(el.textContent).toContain('620.00');
  });

  it('should render the current period toggle labels', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Current Week');
    expect(el.textContent).toContain('Current Month');
    expect(el.textContent).toContain('Current Year');
  });

  it('should expose recap totals', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.recapTotals()).toEqual({ income: '2500.00', expenses: '620.00', balance: '1880.00' });
  });

  it('should hide recap contents by default and show them on toggle', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.recapOpen()).toBe(false);
    expect(el.querySelector('.donut-wrap')).toBeNull();
    expect(el.querySelector('.cmp-list')).toBeNull();
    (el.querySelector('.recap-toggle') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.recapOpen()).toBe(true);
    expect(el.querySelector('.donut-wrap')).not.toBeNull();
    expect(el.querySelector('.cmp-list')).not.toBeNull();
    (el.querySelector('.recap-toggle') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.donut-wrap')).toBeNull();
  });

  it('should switch period KPIs', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setPeriod('year');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1850.00');
  });

  it('should compute pie segments from the breakdown', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const segments = component.pieSegments();
    expect(segments).toHaveLength(2);
    expect(segments[0].name).toBe('Rent');
    expect(segments[0].pct).toBeCloseTo(80.645);
    expect(segments[1].offsetPct).toBeCloseTo(80.645);
    expect(component.totalExpenses()).toBe(620);
  });

  it('should render the category comparison status', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('.recap-toggle')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('over by 35.00');
  });

  it('should render the month comparison average line', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('avg 50.00');
  });

  it('should render an empty state when there is no data', () => {
    service.get.mockReturnValue(
      of({
        periods: {
          week: { income: '0.00', expenses: '0.00', balance: '0.00' },
          month: { income: '0.00', expenses: '0.00', balance: '0.00' },
          year: { income: '0.00', expenses: '0.00', balance: '0.00' },
        },
        recap_totals: { income: '0.00', expenses: '0.00', balance: '0.00' },
        category_breakdown: [],
        category_comparison: [],
        month_comparison: {
          year: 2026,
          month: 7,
          current_total: '0.00',
          previous_years: [],
          average_previous: null,
        },
        monthly_history: [],
      })
    );
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('.recap-toggle')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No expenses recorded this month.');
  });

  it('should fetch with the selected month and scope', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectMonth('2026-06');
    component.setRecapScope('year');
    fixture.detectChanges();
    expect(service.get).toHaveBeenLastCalledWith({ month: '2026-06', scope: 'year' });
  });

  it('should show month and full year labels on history bars', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const bars = component.historyBars();
    expect(bars[0].label).toBe('Jul');
    expect(bars[0].year).toBe('2026');
    const el = fixture.nativeElement as HTMLElement;
    const yearLabels = Array.from(el.querySelectorAll('.bar-year'));
    expect(yearLabels.some((node) => node.textContent === '2026')).toBe(true);
  });

  it('should select a month when clicking a history bar', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const barLabels = Array.from(el.querySelectorAll('.bar-label'));
    const target = barLabels.find((label) => label.textContent?.includes('Jun'));
    (target?.parentElement as HTMLElement).click();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.selectedMonth()).toBe('2026-06');
    expect(component.historyBars().find((bar) => bar.monthKey === '2026-06')?.isCurrent).toBe(true);
  });

  it('should show a named subtitle for a selected past month', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectMonth('2026-07');
    fixture.detectChanges();
    expect(component.recapSubtitle()).toBe('Jul 2026');
  });

  it('should show the year-to-date subtitle when the scope is year', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setRecapScope('year');
    fixture.detectChanges();
    expect(component.recapSubtitle()).toBe('Year to date');
  });

  it('should load transactions for the selected month', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectMonth('2026-06');
    fixture.detectChanges();
    expect(transactionService.list).toHaveBeenLastCalledWith({
      date_from: '2026-06-01',
      date_to: '2026-06-30',
    });
  });

  it('should load transactions from the start of the year when the scope is year', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setRecapScope('year');
    fixture.detectChanges();
    expect(transactionService.list).toHaveBeenLastCalledWith({
      date_from: `${component.selectedMonth().slice(0, 4)}-01-01`,
      date_to: expect.stringContaining(component.selectedMonth()),
    });
  });

  it('should hide the transactions panel by default and reveal it on toggle', () => {
    transactionService.list.mockReturnValue(
      of({
        transactions: [
          {
            id: 1,
            type: 'expense',
            category_id: 1,
            category_name: 'Food',
            amount: '12.50',
            date: '2026-07-10',
            notes: null,
            created_at: '2026-07-10T00:00:00',
            updated_at: '2026-07-10T00:00:00',
          },
        ],
        total: 1,
      })
    );
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    expect(component.transactionsOpen()).toBe(false);
    expect(el.querySelector('.view-transactions')).toBeNull();
    const toggles = el.querySelectorAll('.recap-toggle');
    (toggles[toggles.length - 1] as HTMLElement).click();
    fixture.detectChanges();
    expect(component.transactionsOpen()).toBe(true);
    const section = el.querySelector('.view-transactions');
    expect(section?.textContent).toContain('Food');
    expect(section?.textContent).toContain('12.50');
  });

  it('should paginate the period transactions', () => {
    const transactions = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      type: 'expense' as const,
      category_id: 1,
      category_name: 'Food',
      amount: '12.50',
      date: '2026-07-10',
      notes: null,
      created_at: '2026-07-10T00:00:00',
      updated_at: '2026-07-10T00:00:00',
    }));
    transactionService.list.mockReturnValue(of({ transactions, total: transactions.length }));
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.toggleTransactions();
    fixture.detectChanges();
    expect(component.pagedTransactions()).toHaveLength(10);
    expect(component.totalPages()).toBe(3);
    expect(component.txPage()).toBe(1);
    component.setTxPage(3);
    fixture.detectChanges();
    expect(component.pagedTransactions()).toHaveLength(5);
    component.setTxPage(99);
    expect(component.txPage()).toBe(3);
  });
});
