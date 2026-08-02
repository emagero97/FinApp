import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CategoryFormComponent } from './category-form.component';
import { CategoryService } from '../services/category.service';
import { Category } from '../models/category';

describe('CategoryFormComponent', () => {
  let service: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      create: vi.fn().mockReturnValue(of({ id: 1 })),
      update: vi.fn().mockReturnValue(of({ id: 1 })),
    };
    TestBed.configureTestingModule({
      imports: [CategoryFormComponent],
      providers: [provideHttpClient(), { provide: CategoryService, useValue: service }],
    });
  });

  it('should submit a new category', () => {
    const fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const savedSpy = vi.spyOn(component.saved, 'emit');

    component.form.patchValue({ name: 'Salary', type: 'income', status: 'enabled' });
    component.submit();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Salary', type: 'income', status: 'enabled' })
    );
    expect(savedSpy).toHaveBeenCalled();
  });

  it('should not submit an invalid form', () => {
    const fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ name: '   ' });
    component.submit();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('should lock the type when editing a category with transactions', () => {
    const category = {
      id: 1,
      name: 'Groceries',
      type: 'expense',
      status: 'enabled',
      transaction_count: 3,
    } as Category;
    const fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.componentRef.setInput('category', category);
    fixture.detectChanges();
    expect(fixture.componentInstance.typeLocked).toBe(true);
  });

  it('should surface the server error message', () => {
    service.create.mockReturnValue(
      throwError(() => ({
        error: { errors: { name: 'A expense category named \'Groceries\' already exists' } },
      }))
    );
    const fixture = TestBed.createComponent(CategoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ name: 'Groceries', type: 'expense', status: 'enabled' });
    component.submit();
    fixture.detectChanges();
    expect(component.error()).toContain('already exists');
  });

  it('should submit a subcategory with a parent', () => {
    const fixture = TestBed.createComponent(CategoryFormComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('parentOptions', [
      { id: 5, name: 'Food' } as unknown as Category,
    ]);
    fixture.detectChanges();

    component.form.patchValue({
      name: 'Groceries',
      type: 'expense',
      status: 'enabled',
      parent_id: 5,
    });
    component.submit();

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Groceries', type: 'expense', parent_id: 5 })
    );
  });
});
