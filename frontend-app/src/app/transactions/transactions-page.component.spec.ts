import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { TransactionsPageComponent } from './transactions-page.component';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { Category } from '../models/category';
import { Transaction } from '../models/transaction';

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

describe('TransactionsPageComponent', () => {
  let categoryService: { list: ReturnType<typeof vi.fn> };
  let transactionService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    categoryService = { list: vi.fn().mockReturnValue(of({ categories: [expenseCategory, incomeCategory], total: 2 })) };
    transactionService = {
      list: vi.fn().mockReturnValue(of({ transactions: [sampleTransaction], total: 1 })),
      create: vi.fn().mockReturnValue(of(sampleTransaction)),
      update: vi.fn().mockReturnValue(of(sampleTransaction)),
      delete: vi.fn().mockReturnValue(of(null)),
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
});
