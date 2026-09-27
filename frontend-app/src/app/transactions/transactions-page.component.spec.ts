import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { defer, of, throwError } from 'rxjs';
import { TransactionsPageComponent } from './transactions-page.component';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { Category } from '../models/category';
import { Transaction, TransactionListResponse } from '../models/transaction';

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

const incomeCategory: Category = {
  ...expenseCategory,
  id: 2,
  name: 'Salary',
  type: 'income',
};

const disabledExpense: Category = {
  ...expenseCategory,
  id: 3,
  name: 'Old expense',
  status: 'disabled',
};

const foodCategory: Category = {
  ...expenseCategory,
  id: 4,
  name: 'Food',
  child_count: 2,
};

const groceriesChild: Category = {
  ...expenseCategory,
  id: 5,
  name: 'Groceries child',
  parent_id: 4,
};

const diningChild: Category = {
  ...expenseCategory,
  id: 6,
  name: 'Dining out',
  parent_id: 4,
};

const sampleTransaction: Transaction = {
  id: 10,
  type: 'expense',
  category_id: 1,
  category_name: 'Groceries',
  amount: '12.50',
  date: '2026-07-15',
  notes: 'weekly shop',
  created_at: '',
  updated_at: '',
};

const secondTransaction: Transaction = {
  ...sampleTransaction,
  id: 11,
  notes: 'household',
  amount: '30.00',
};

const thirdTransaction: Transaction = {
  ...sampleTransaction,
  id: 12,
  notes: 'restaurant',
  amount: '45.00',
};

describe('TransactionsPageComponent', () => {
  let categoryService: { list: ReturnType<typeof vi.fn> };
  let transactionService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    bulkDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    categoryService = { list: vi.fn().mockReturnValue(of({ categories: [expenseCategory, incomeCategory], total: 2 })) };
    transactionService = {
      list: vi.fn().mockReturnValue(of({ transactions: [sampleTransaction], total: 1 })),
      create: vi.fn().mockReturnValue(of(sampleTransaction)),
      update: vi.fn().mockReturnValue(of(sampleTransaction)),
      delete: vi.fn().mockReturnValue(of(null)),
      bulkDelete: vi.fn().mockReturnValue(of({ deleted: 0 })),
    };
    TestBed.configureTestingModule({
      imports: [TransactionsPageComponent],
      providers: [
        provideHttpClient(),
        { provide: CategoryService, useValue: categoryService },
        { provide: TransactionService, useValue: transactionService },
      ],
    });
  });

  it('should render transactions from the service', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Groceries');
    expect(el.textContent).toContain('weekly shop');
    expect(el.textContent).toContain('12.50');
  });

  it('should render the actions column header above the edit/delete buttons', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toContain('Actions');
    expect(el.querySelector('thead th.actions')?.textContent).toBe('Actions');
    expect(el.querySelector('tbody td.actions button')).toBeTruthy();
  });

  it('should default the date to today and filter categories by type', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.form.controls.date.value).toBeTruthy();
    component.form.controls.type.setValue('income');
    expect(component.availableCategories().map((c) => c.name)).toEqual(['Salary']);
  });

  it('should submit a new transaction', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({
      type: 'expense',
      category_id: 1,
      date: '2026-07-15',
      amount: 12.5,
      notes: 'test',
    });
    component.submit();
    expect(transactionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 1, amount: 12.5, notes: 'test' })
    );
  });

  it('should not submit an invalid form', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ amount: null, category_id: null });
    component.submit();
    expect(transactionService.create).not.toHaveBeenCalled();
  });

  it('should include a disabled category when editing its transaction', () => {
    categoryService.list.mockReturnValue(of({ categories: [expenseCategory, incomeCategory, disabledExpense], total: 3 }));
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const tx: Transaction = { ...sampleTransaction, category_id: 3, category_name: 'Old expense' };
    component.startEdit(tx);
    expect(component.availableCategories().map((c) => c.name)).toContain('Old expense');
  });

  it('should only offer top-level categories for the main category select', () => {
    categoryService.list.mockReturnValue(
      of({ categories: [foodCategory, groceriesChild, diningChild, incomeCategory], total: 4 })
    );
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.type.setValue('expense');
    expect(component.availableCategories().map((c) => c.name)).toEqual(['Food']);
  });

  it('should expose sub-categories of the selected category', () => {
    categoryService.list.mockReturnValue(
      of({ categories: [foodCategory, groceriesChild, diningChild, incomeCategory], total: 4 })
    );
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ type: 'expense', category_id: 4 });
    expect(component.hasSubcategories()).toBe(true);
    expect(component.subcategoriesOfSelected().map((c) => c.name)).toEqual([
      'Groceries child',
      'Dining out',
    ]);
  });

  it('should submit the selected sub-category id, falling back to the parent', () => {
    categoryService.list.mockReturnValue(
      of({ categories: [foodCategory, groceriesChild, diningChild, incomeCategory], total: 4 })
    );
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({
      type: 'expense',
      category_id: 4,
      subcategory_id: 5,
      date: '2026-07-15',
      amount: 10,
      notes: '',
    });
    component.submit();
    expect(transactionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ category_id: 5 })
    );

    component.form.patchValue({
      category_id: 4,
      subcategory_id: null,
      date: '2026-07-15',
      amount: 10,
      notes: '',
    });
    component.submit();
    expect(transactionService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ category_id: 4 })
    );
  });

  it('should restore parent + sub-category when editing a sub-category transaction', () => {
    categoryService.list.mockReturnValue(
      of({ categories: [foodCategory, groceriesChild, diningChild, incomeCategory], total: 4 })
    );
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const tx: Transaction = { ...sampleTransaction, category_id: 5, category_name: 'Groceries child' };
    component.startEdit(tx);
    expect(component.form.controls.category_id.value).toBe(4);
    expect(component.form.controls.subcategory_id.value).toBe(5);
  });

  it('should show the full category path in the list for sub-category transactions', () => {
    categoryService.list.mockReturnValue(
      of({ categories: [foodCategory, groceriesChild, diningChild, incomeCategory], total: 4 })
    );
    transactionService.list.mockReturnValue(
      of({
        transactions: [
          { ...sampleTransaction, category_id: 5, category_name: 'Groceries child' },
        ],
        total: 1,
      })
    );
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const tx = component.transactions()[0];
    expect(component.categoryPath(tx)).toBe('Food / Groceries child');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Food / Groceries child');
  });

  it('should update when editing and delete on confirm', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.startEdit(sampleTransaction);
    component.form.patchValue({ amount: 20 });
    component.submit();
    expect(transactionService.update).toHaveBeenCalledWith(10, expect.objectContaining({ amount: 20 }));

    component.requestDelete(sampleTransaction);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Delete transaction?');
    component.confirmDelete();
    expect(transactionService.delete).toHaveBeenCalledWith(10);
  });

  it('should send the search query when typing in the search input', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input.search') as HTMLInputElement;
    input.value = 'shop';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(transactionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'shop' }));
  });

  it('should apply the category filter with the selected category id, not its label', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select.filter');
    const categorySelect = selects[1] as HTMLSelectElement;
    expect(categorySelect.options.length).toBe(3);
    categorySelect.selectedIndex = 1; // Groceries
    categorySelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(transactionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ category_id: 1 }));
  });

  it('should reset the category filter to null when "All categories" is selected', () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.filterCategory.set(1);
    fixture.detectChanges();
    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select.filter');
    const categorySelect = selects[1] as HTMLSelectElement;
    categorySelect.selectedIndex = 0; // All categories
    categorySelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.filterCategory()).toBeNull();
    expect(transactionService.list).toHaveBeenLastCalledWith({});
  });

  it('should ignore stale in-flight responses and keep the latest search results', async () => {
    const fixture = TestBed.createComponent(TransactionsPageComponent);
    fixture.detectChanges();

    let resolveStale!: (v: TransactionListResponse) => void;
    let resolveFresh!: (v: TransactionListResponse) => void;
    const stale = new Promise<TransactionListResponse>((r) => (resolveStale = r));
    const fresh = new Promise<TransactionListResponse>((r) => (resolveFresh = r));

    transactionService.list
      .mockReturnValueOnce(defer(() => stale))
      .mockReturnValueOnce(defer(() => fresh));

    const input = (fixture.nativeElement as HTMLElement).querySelector('input.search') as HTMLInputElement;

    input.value = 'sp';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    input.value = 'spesa';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    resolveFresh({ transactions: [{ ...sampleTransaction, id: 2, notes: 'fresh' }], total: 1 });
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fixture.componentInstance.transactions().map((t) => t.notes)).toEqual(['fresh']);

    resolveStale({ transactions: [{ ...sampleTransaction, id: 1, notes: 'stale' }], total: 1 });
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect(fixture.componentInstance.transactions().map((t) => t.notes)).toEqual(['fresh']);
  });

  describe('delete mode', () => {
    beforeEach(() => {
      transactionService.list.mockReturnValue(
        of({ transactions: [sampleTransaction, secondTransaction, thirdTransaction], total: 3 })
      );
      transactionService.bulkDelete.mockReturnValue(of({ deleted: 2 }));
    });

    it('should hide checkboxes until delete mode is entered', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('input.row-check').length).toBe(0);
      expect(el.querySelector('.selection-bar')).toBeNull();
      expect(el.querySelector('thead th.actions')?.textContent).toBe('Actions');
    });

    it('should reveal a checkbox per row and hide the actions column in delete mode', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('input.row-check').length).toBe(3);
      expect(el.querySelector('thead th.actions')).toBeNull();
      expect(el.querySelector('.selection-bar')).toBeTruthy();
    });

    it('should enter delete mode from the header button', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const button = Array.from(el.querySelectorAll('.header-actions button')).find((b) =>
        (b.textContent ?? '').includes('Select')
      ) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.deleteMode()).toBe(true);
    });

    it('should toggle individual rows and track the selected count', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      fixture.detectChanges();

      component.toggleSelect(10);
      component.toggleSelect(12);
      fixture.detectChanges();
      expect([...component.selectedIds()]).toEqual([10, 12]);
      expect(component.selectedCount()).toBe(2);
      expect(component.isSelected(11)).toBe(false);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('2 selected');

      component.toggleSelect(10);
      expect([...component.selectedIds()]).toEqual([12]);
    });

    it('should mark rows as selected in the DOM', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelect(11);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const boxes = el.querySelectorAll('input.row-check') as NodeListOf<HTMLInputElement>;
      expect(Array.from(boxes).map((b) => b.checked)).toEqual([false, true, false]);
      expect(el.querySelectorAll('tr.row-selected').length).toBe(1);
    });

    it('should select and clear every row with the select all toggle', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();

      component.toggleSelectAll();
      expect(component.selectedCount()).toBe(3);
      expect(component.allSelected()).toBe(true);
      expect(component.allMatching()).toBe(true);

      component.toggleSelectAll();
      expect(component.selectedCount()).toBe(0);
      expect(component.allMatching()).toBe(false);
    });

    it('should break the "all matching" shortcut when one row is deselected', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelectAll();
      component.toggleSelect(10);
      expect(component.allMatching()).toBe(false);
      expect([...component.selectedIds()]).toEqual([11, 12]);
    });

    it('should keep the whole filtered set selected across a reload', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelectAll();

      // A narrower filter returns a different set of rows; all of them stay selected.
      transactionService.list.mockReturnValue(of({ transactions: [thirdTransaction], total: 1 }));
      component.filterCategory.set(1);
      component.load();
      fixture.detectChanges();
      expect([...component.selectedIds()]).toEqual([12]);
    });

    it('should drop selected rows that no longer match the filters', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelect(10);
      component.toggleSelect(11);

      transactionService.list.mockReturnValue(of({ transactions: [secondTransaction], total: 1 }));
      component.searchQuery.set('household');
      component.load();
      fixture.detectChanges();
      expect([...component.selectedIds()]).toEqual([11]);
    });

    it('should confirm before deleting and send the selected ids', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelect(10);
      component.toggleSelect(12);

      component.requestBulkDelete();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Delete selected transactions?'
      );
      expect(transactionService.bulkDelete).not.toHaveBeenCalled();

      component.confirmBulkDelete();
      expect(transactionService.bulkDelete).toHaveBeenCalledWith([10, 12]);
      expect(component.bulkDeleteTarget()).toBeNull();
    });

    it('should delete everything the filters match when all rows are selected', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.onFilterCategory(1);
      component.enterDeleteMode();
      component.toggleSelectAll();
      component.requestBulkDelete();
      component.confirmBulkDelete();
      expect(transactionService.bulkDelete).toHaveBeenCalledWith([10, 11, 12]);
    });

    it('should not open the confirmation when nothing is selected', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.requestBulkDelete();
      expect(component.bulkDeleteTarget()).toBeNull();
    });

    it('should clear the selection and show a notice after deleting', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelectAll();
      component.requestBulkDelete();
      component.confirmBulkDelete();
      fixture.detectChanges();
      expect(component.selectedCount()).toBe(0);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Deleted 2 transaction(s).');
    });

    it('should report an error and keep the selection when the delete fails', () => {
      transactionService.bulkDelete.mockReturnValue(throwError(() => ({ error: { error: 'Nope' } })));
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelect(10);
      component.requestBulkDelete();
      component.confirmBulkDelete();
      fixture.detectChanges();
      expect(component.error()).toBe('Nope');
      expect(component.selectedCount()).toBe(1);
      expect(component.bulkDeleting()).toBe(false);
    });

    it('should discard the selection when leaving delete mode', () => {
      const fixture = TestBed.createComponent(TransactionsPageComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.enterDeleteMode();
      component.toggleSelect(10);
      component.exitDeleteMode();
      fixture.detectChanges();
      expect(component.deleteMode()).toBe(false);
      expect(component.selectedCount()).toBe(0);
      expect((fixture.nativeElement as HTMLElement).querySelector('input.row-check')).toBeNull();
    });
  });
});
