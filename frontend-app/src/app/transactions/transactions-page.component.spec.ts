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
