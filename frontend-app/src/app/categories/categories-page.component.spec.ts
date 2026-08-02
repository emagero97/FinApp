import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { CategoriesPageComponent } from './categories-page.component';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category';

function sampleCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'Groceries',
    type: 'expense',
    status: 'enabled',
    parent_id: null,
    parent_name: null,
    child_count: 0,
    description: null,
    icon: null,
    color: '#f59e0b',
    display_order: 0,
    transaction_count: 2,
    total_amount: '35.50',
    last_transaction_date: '2026-01-15',
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    ...overrides,
  };
}

describe('CategoriesPageComponent', () => {
  let service: { list: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn().mockReturnValue(of({ categories: [sampleCategory()], total: 1 })),
      update: vi.fn().mockReturnValue(of(sampleCategory())),
      delete: vi.fn().mockReturnValue(of(null)),
    };
    TestBed.configureTestingModule({
      imports: [CategoriesPageComponent],
      providers: [provideHttpClient(), { provide: CategoryService, useValue: service }],
    });
  });

  it('should render categories from the service', () => {
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Groceries');
    expect(el.textContent).toContain('Expense');
    expect(el.textContent).toContain('2');
  });

  it('should show the create form when "New category" is clicked', () => {
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('New category')
    );
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.querySelector('app-category-form')).toBeTruthy();
  });

  it('should open a confirm dialog when deleting a category with no transactions', () => {
    service.list.mockReturnValue(of({ categories: [sampleCategory({ transaction_count: 0 })], total: 1 }));
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Delete'
    );
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(text.includes('permanently delete') || text.includes('cannot be undone')).toBe(true);
  });

  it('should block delete and explain when category has transactions', () => {
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Delete'
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.textContent).toContain('Category cannot be deleted');
  });

  it('should render subcategories under their parent', () => {
    const parent = sampleCategory();
    const child = sampleCategory({
      id: 2,
      name: 'Vegetables',
      parent_id: 1,
      parent_name: 'Groceries',
    });
    service.list.mockReturnValue(of({ categories: [child, parent], total: 2 }));
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const childRow = Array.from(el.querySelectorAll('tr.child-row')).find((r) =>
      r.textContent?.includes('Vegetables')
    );
    expect(childRow).toBeTruthy();
    expect(childRow?.classList.contains('row-disabled')).toBe(false);
  });

  it('should block delete of a parent with children', () => {
    const parent = sampleCategory({ id: 1, child_count: 1 });
    service.list.mockReturnValue(of({ categories: [parent], total: 1 }));
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Delete'
    );
    expect((button as HTMLButtonElement).disabled).toBe(true);
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.textContent).toContain('subcategor');
  });

  it('should call update when confirming disable', () => {
    const fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Disable'
    );
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.textContent).toContain('Disable category?');
    const dialog = el.querySelector('app-confirm-dialog') as HTMLElement;
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.trim() === 'Disable'
    );
    confirmBtn?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(service.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'disabled' }));
  });
});
