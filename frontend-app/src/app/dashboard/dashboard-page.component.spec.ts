import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DashboardPageComponent } from './dashboard-page.component';
import { DashboardService } from '../services/dashboard.service';
import { DashboardSummary } from '../models/dashboard';

function sampleSummary(): DashboardSummary {
  return {
    periods: {
      week: { income: '0.00', expenses: '0.00', balance: '0.00' },
      month: { income: '2500.00', expenses: '620.00', balance: '1880.00' },
      year: { income: '2500.00', expenses: '650.00', balance: '1850.00' },
    },
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
      { month: '2026-07', total: '620.00' },
      { month: '2026-06', total: '0.00' },
    ],
  };
}

describe('DashboardPageComponent', () => {
  let service: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { get: vi.fn().mockReturnValue(of(sampleSummary())) };
    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), { provide: DashboardService, useValue: service }],
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
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No expenses recorded this month.');
  });
});
