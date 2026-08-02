import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { ExportPageComponent } from './export-page.component';
import { CategoryService } from '../services/category.service';
import { ExportService } from '../services/export.service';
import { Category } from '../models/category';

const expenseCategory: Category = {
  id: 1,
  name: 'Groceries',
  type: 'expense',
  status: 'enabled',
  parent_id: null,
  parent_name: null,
  child_count: 0,
  description: null,
  icon: null,
  color: null,
  display_order: 0,
  transaction_count: 0,
  total_amount: '0',
  last_transaction_date: null,
  created_at: '',
  updated_at: '',
};

const incomeCategory: Category = { ...expenseCategory, id: 2, name: 'Salary', type: 'income' };

describe('ExportPageComponent', () => {
  let categoryService: { list: ReturnType<typeof vi.fn> };
  let exportService: {
    preview: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    categoryService = {
      list: vi.fn().mockReturnValue(of({ categories: [expenseCategory, incomeCategory], total: 2 })),
    };
    exportService = {
      preview: vi.fn().mockReturnValue(of({ count: 5 })),
      download: vi.fn().mockReturnValue(of({ body: new Blob(['data']), headers: new Map() })),
    };
    TestBed.configureTestingModule({
      imports: [ExportPageComponent],
      providers: [
        provideHttpClient(),
        { provide: CategoryService, useValue: categoryService },
        { provide: ExportService, useValue: exportService },
      ],
    });
  });

  it('should load categories, default include all and preview the count', () => {
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.categories().length).toBe(2);
    expect(component.allIncluded()).toBe(true);
    expect(component.preview()).toBe(5);
  });

  it('should render the summary labels', () => {
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Groceries');
    expect(el.textContent).toContain('Salary');
  });

  it('should exclude a category and pass included ids to preview', () => {
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.toggleCategory(incomeCategory);
    expect(component.excludedCategories().map((c) => c.id)).toContain(2);
    const query = component.buildQuery();
    expect(query.include_category_ids).toEqual([1]);
  });

  it('should mark a custom range as invalid when start is after end', () => {
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.period.set('CUSTOM');
    component.customFrom.set('2026-08-01');
    component.customTo.set('2026-07-01');
    expect(component.customRangeInvalid()).toBe(true);
  });

  it('should not download when there are zero matching rows', () => {
    exportService.preview.mockReturnValue(of({ count: 0 }));
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.download();
    expect(exportService.download).not.toHaveBeenCalled();
  });

  it('should download the csv when rows match', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });
    const fixture = TestBed.createComponent(ExportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.download();
    expect(exportService.download).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
  });
});