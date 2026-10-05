import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, Observable } from 'rxjs';
import { ImportPageComponent } from './import-page.component';
import { ImportService } from '../services/import.service';
import { ImportPreview } from '../models/import';

const previewResponse: ImportPreview = {
  total: 2,
  invalid: 1,
  pending: 0,
  resolved: 2,
  rows: [
    { line: 2, date: '2026-01-02', category: 'Svago', matched: true, suggested_category_id: null, type: 'expense', amount: -15, notes: 'Bowling' },
    { line: 3, date: '2026-01-03', category: 'Veicoli', matched: true, suggested_category_id: null, type: 'expense', amount: -40, notes: 'benzina' },
  ],
  invalid_rows: [{ line: 4, errors: ['Date must use the format YYYY-MM-DD'] }],
  summary_months: [{ month: '2026-01', count: 2, income: 0, expenses: -55, total: -55 }],
  summary_years: [{ year: '2026', count: 2, income: 0, expenses: -55, total: -55 }],
  category_options: {
    income: [{ id: 1, name: 'Freelance' }],
    expense: [
      { id: 2, name: 'Groceries' },
      { id: 3, name: 'Fuel' },
    ],
  },
};

const pendingResponse: ImportPreview = {
  total: 3,
  invalid: 0,
  pending: 3,
  resolved: 0,
  rows: [
    { line: 2, date: '2026-01-02', category: 'Svago', matched: false, suggested_category_id: null, type: 'expense', amount: -15, notes: 'Bowling' },
    { line: 3, date: '2026-01-03', category: null, matched: false, suggested_category_id: null, type: 'expense', amount: -40, notes: 'benzina' },
    { line: 4, date: '2026-01-04', category: null, matched: false, suggested_category_id: null, type: 'income', amount: 1200, notes: 'stipendio' },
  ],
  invalid_rows: [],
  summary_months: [{ month: '2026-01', count: 3, income: 1200, expenses: -55, total: 1145 }],
  summary_years: [{ year: '2026', count: 3, income: 1200, expenses: -55, total: 1145 }],
  category_options: {
    income: [{ id: 1, name: 'Freelance' }],
    expense: [{ id: 2, name: 'Groceries' }],
  },
};

const suggestedResponse: ImportPreview = {
  ...pendingResponse,
  rows: pendingResponse.rows.map((row) =>
    row.line === 4 ? { ...row, suggested_category_id: 1 } : row,
  ),
};

const emptyCategoryResponse: ImportPreview = {
  ...pendingResponse,
  total: 2,
  pending: 2,
  resolved: 0,
  rows: [
    { line: 2, date: '2026-01-03', category: null, matched: false, suggested_category_id: null, type: 'expense', amount: -40, notes: 'benzina' },
    { line: 3, date: '2026-01-04', category: null, matched: false, suggested_category_id: null, type: 'income', amount: 1200, notes: 'stipendio' },
  ],
  summary_months: [{ month: '2026-01', count: 2, income: 1200, expenses: -40, total: 1160 }],
  summary_years: [{ year: '2026', count: 2, income: 1200, expenses: -40, total: 1160 }],
};

const groupedResponse: ImportPreview = {
  total: 5,
  invalid: 0,
  pending: 5,
  resolved: 0,
  rows: [
    { line: 2, date: '2026-01-02', category: 'Ristorante', matched: false, suggested_category_id: null, type: 'expense', amount: -20, notes: 'Sbraciata' },
    { line: 3, date: '2026-01-05', category: 'Ristorante', matched: false, suggested_category_id: null, type: 'expense', amount: -25, notes: 'Sbraciata' },
    { line: 4, date: '2026-01-06', category: 'Bar', matched: false, suggested_category_id: null, type: 'expense', amount: -7, notes: 'Colazione' },
    { line: 5, date: '2026-01-07', category: null, matched: false, suggested_category_id: null, type: 'income', amount: 1200, notes: null },
    { line: 6, date: '2026-01-08', category: null, matched: false, suggested_category_id: null, type: 'income', amount: 300, notes: null },
  ],
  invalid_rows: [],
  summary_months: [{ month: '2026-01', count: 5, income: 1500, expenses: -52, total: 1448 }],
  summary_years: [{ year: '2026', count: 5, income: 1500, expenses: -52, total: 1448 }],
  category_options: {
    income: [{ id: 1, name: 'Freelance' }],
    expense: [{ id: 2, name: 'Groceries' }],
  },
};

function groupKeyFor(component: ImportPageComponent, line: number): string {
  const group = component.groups().find((item) => item.rows.some((row) => row.line === line));
  if (!group) {
    throw new Error(`no group for line ${line}`);
  }
  return group.key;
}

describe('ImportPageComponent', () => {
  let importService: {
    preview: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };

  function setup(preview: ImportPreview = previewResponse) {
    importService.preview.mockReturnValue(of(preview));
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();
    return { fixture, component };
  }

  beforeEach(() => {
    importService = {
      preview: vi.fn().mockReturnValue(of(previewResponse)),
      commit: vi.fn().mockReturnValue(of({ inserted: 2, categories_created: ['Svago', 'Veicoli'] })),
    };
    TestBed.configureTestingModule({
      imports: [ImportPageComponent],
      providers: [
        provideHttpClient(),
        { provide: ImportService, useValue: importService },
      ],
    });
  });

  it('should show the preview recap after parsing content', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();

    expect(component.preview()?.total).toBe(2);
    expect(component.preview()?.pending).toBe(0);
    expect(component.preview()?.resolved).toBe(2);
    expect(component.canImport()).toBe(true);
  });

  it('should not analyze until the user confirms the file', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');

    expect(component.preview()).toBeNull();
    expect(component.processing()).toBe(false);
    expect(importService.preview).not.toHaveBeenCalled();

    component.runPreview();
    expect(importService.preview).toHaveBeenCalledWith('csv');
  });

  it('should render the analyze button always', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Analyze CSV');
  });

  it('should not call preview without a file and show a message', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.runPreview();

    expect(importService.preview).not.toHaveBeenCalled();
    expect(component.error()).toBe('Select a CSV file first.');
  });

  it('should read the selected file and start analysis on click', async () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const file = new File(['2026-01-02;Svago;-15.0;Bowling'], 'test.csv');
    component.onFileSelected({ files: [file] } as unknown as HTMLInputElement);

    expect(component.selectedFile()?.name).toBe('test.csv');
    expect(importService.preview).not.toHaveBeenCalled();

    component.runPreview();
    await vi.waitFor(() => expect(importService.preview).toHaveBeenCalled());
    expect(importService.preview).toHaveBeenCalledWith(expect.stringContaining('Svago'));
  });

  it('should show a progress status while analyzing', () => {
    importService.preview.mockReturnValue(new Observable(() => {}));
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();

    expect(component.processing()).toBe(true);
    expect(component.statusText()).toContain('Analyzing');
  });

  it('should render the recap tables', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('By month');
    expect(el.textContent).toContain('By year');
    expect(el.textContent).toContain('January 2026');
    expect(el.textContent).toContain('2026');
  });

  it('should render the summary total as a net signed amount', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Income');
    expect(el.textContent).toContain('Expenses');
    expect(el.textContent).toContain('0.00');
    expect(el.textContent).toContain('-55.00');
  });

  it('should not offer any automatic category creation', () => {
    const { fixture } = setup(pendingResponse);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('New categories to create');
    expect(el.textContent).not.toContain('Create the missing categories');
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('should block import when there are no valid rows', () => {
    importService.preview.mockReturnValue(of({ ...previewResponse, total: 0 }));
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();

    expect(component.canImport()).toBe(false);
  });

  it('should commit and show the result', () => {
    const { fixture, component } = setup();
    component.confirmImport();
    fixture.detectChanges();

    expect(importService.commit).toHaveBeenCalledWith('csv', []);
    expect(component.result()?.inserted).toBe(2);
    expect(component.preview()).toBeNull();
  });

  it('should format month and amount', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.formatMonth('2026-01')).toBe('January 2026');
    expect(component.formatAmount(-55)).toBe('-55.00');
  });

  it('should list the rows that still need a category and only offer categories of the same type', () => {
    const { component } = setup(pendingResponse);

    expect(component.groups().map((group) => group.rows.map((row) => row.line))).toEqual([[2], [3], [4]]);
    expect(component.groupsOfType('expense').map((group) => group.rows[0].line)).toEqual([2, 3]);
    expect(component.groupsOfType('income').map((group) => group.rows[0].line)).toEqual([4]);
    expect(component.categoriesFor('income')).toEqual([{ id: 1, name: 'Freelance' }]);
    expect(component.categoriesFor('expense')).toEqual([{ id: 2, name: 'Groceries' }]);
  });

  it('should render the assignment controls for every pending group', () => {
    const { fixture } = setup(pendingResponse);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Transactions without a matching category');
    expect(el.textContent).toContain('3 transaction(s) still need a category');
    expect(el.querySelectorAll('.assign-row').length).toBe(3);
    expect(el.querySelectorAll('.assign-controls select').length).toBe(3);
  });

  it('should show the category found in the file without filling the new category field', () => {
    const { fixture, component } = setup(pendingResponse);
    const el = fixture.nativeElement as HTMLElement;
    const key = groupKeyFor(component, 2);

    expect(component.fileCategoryLabel('Svago')).toContain('Svago');
    expect(el.querySelectorAll('.tag-file-category').length).toBe(1);
    expect(el.querySelectorAll('.assign-controls input').length).toBe(3);
    expect(component.draftFor(key)).toBe('');
    expect((el.querySelectorAll('.assign-controls input')[0] as HTMLInputElement).value).toBe('');
  });

  it('should prefill the note field with the note found in the file', () => {
    const { fixture, component } = setup(pendingResponse);
    const el = fixture.nativeElement as HTMLElement;
    const key = groupKeyFor(component, 2);

    expect(component.noteFor(key)).toBe('Bowling');
    expect(component.noteChanged(key)).toBe(false);
    expect(el.textContent).not.toContain('Replaces the note from the file');

    const notes = el.querySelectorAll<HTMLInputElement>('.assign-note input');
    expect(notes.length).toBe(3);
    expect(notes[0].value).toBe('Bowling');
    expect(notes[2].value).toBe('stipendio');
  });

  it('should offer an empty note field for rows without a note in the file', () => {
    const { fixture, component } = setup(groupedResponse);
    const el = fixture.nativeElement as HTMLElement;

    expect(component.noteFor(groupKeyFor(component, 5))).toBe('');
    expect(el.querySelectorAll<HTMLInputElement>('.assign-note input')[3].value).toBe('');
  });

  it('should show the note field only for the rows that need a category', () => {
    const { fixture } = setup(previewResponse);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('.assign-note input').length).toBe(0);
  });

  it('should apply the note typed for a group to all its rows', () => {
    const { component } = setup(groupedResponse);
    const key = groupKeyFor(component, 2);
    component.setExistingChoice(key, '2');
    component.setNote(key, '  Cena con amici  ');

    expect(component.noteChanged(key)).toBe(true);
    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2, notes: 'Cena con amici' },
      { line: 3, category_id: 2, notes: 'Cena con amici' },
    ]);
  });

  it('should keep the file note when the field is left untouched', () => {
    const { component } = setup(pendingResponse);
    const key = groupKeyFor(component, 2);
    component.setExistingChoice(key, '2');
    component.setNote(key, 'Bowling');

    expect(component.noteChanged(key)).toBe(false);
    expect(component.assignments()).toEqual([{ line: 2, category_id: 2 }]);
  });

  it('should submit an empty note when the user clears the field', () => {
    const { component } = setup(pendingResponse);
    const key = groupKeyFor(component, 2);
    component.setExistingChoice(key, '2');
    component.setNote(key, '');

    expect(component.assignments()).toEqual([{ line: 2, category_id: 2, notes: '' }]);
  });

  it('should submit the note together with the new category', () => {
    const { component } = setup(emptyCategoryResponse);
    const expenseKey = groupKeyFor(component, 2);
    const incomeKey = groupKeyFor(component, 3);
    component.setExistingChoice(expenseKey, '2');
    component.setNote(incomeKey, 'Stipendio gennaio');
    component.setDraft(incomeKey, 'Stipendio');
    component.confirmNewChoice(incomeKey);

    component.confirmImport();

    expect(importService.commit).toHaveBeenCalledWith('csv', [
      { line: 2, category_id: 2 },
      { line: 3, category: 'Stipendio', notes: 'Stipendio gennaio' },
    ]);
  });

  it('should tell the user when the note replaces the one from the file', () => {
    const { fixture, component } = setup(pendingResponse);
    const key = groupKeyFor(component, 2);
    component.setNote(key, 'Bowling night');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Replaces the note from the file');
  });

  it('should group rows sharing the same category and notes', () => {
    const { component } = setup(groupedResponse);

    expect(component.groups().map((group) => group.rows.map((row) => row.line))).toEqual([
      [2, 3],
      [4],
      [5],
      [6],
    ]);
  });

  it('should keep rows with neither category nor notes on separate groups', () => {
    const { component } = setup(groupedResponse);
    const keys = [5, 6].map((line) => groupKeyFor(component, line));

    expect(new Set(keys).size).toBe(2);
  });

  it('should never group rows of different transaction types', () => {
    const response: ImportPreview = {
      ...groupedResponse,
      rows: [
        { line: 2, date: '2026-01-02', category: 'Extra', matched: false, suggested_category_id: null, type: 'expense', amount: -20, notes: 'regalo' },
        { line: 3, date: '2026-01-03', category: 'Extra', matched: false, suggested_category_id: null, type: 'income', amount: 20, notes: 'regalo' },
      ],
      total: 2,
      pending: 2,
    };
    const { component } = setup(response);

    expect(component.groups().map((group) => group.type)).toEqual(['expense', 'income']);
  });

  it('should apply the category chosen for a group to all its rows', () => {
    const { component } = setup(groupedResponse);
    const key = groupKeyFor(component, 2);
    component.setExistingChoice(key, '2');

    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2 },
      { line: 3, category_id: 2 },
    ]);
    expect(component.unassignedCount()).toBe(3);
    expect(component.canImport()).toBe(false);

    component.applyExistingToAll('income', '1');
    component.setExistingChoice(groupKeyFor(component, 4), '2');

    expect(component.canImport()).toBe(true);
    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2 },
      { line: 3, category_id: 2 },
      { line: 4, category_id: 2 },
      { line: 5, category_id: 1 },
      { line: 6, category_id: 1 },
    ]);
  });

  it('should create a new category once for the whole group', () => {
    const { component } = setup(groupedResponse);
    const key = groupKeyFor(component, 2);
    component.setDraft(key, 'Ristoranti');
    component.confirmNewChoice(key);

    expect(component.assignments()).toEqual([
      { line: 2, category: 'Ristoranti' },
      { line: 3, category: 'Ristoranti' },
    ]);
    expect(component.assignedCategoryName(key)).toBe('Ristoranti');
  });

  it('should describe a group with its lines, dates, count and total', () => {
    const { component } = setup(groupedResponse);
    const group = component.groups()[0];

    expect(component.groupLinesLabel(group)).toBe('Lines 2, 3');
    expect(component.groupCountLabel(group)).toBe('2 transactions');
    expect(component.groupDatesLabel(group)).toBe('2026-01-02 – 2026-01-05');
    expect(component.groupTotal(group)).toBe(-45);
    expect(component.groupLinesLabel(component.groups()[1])).toBe('Line 4');
    expect(component.groupCountLabel(component.groups()[1])).toBe('1 transactions');
  });

  it('should block the import until every pending row has a category', () => {
    const { component } = setup(pendingResponse);

    expect(component.unassignedCount()).toBe(3);
    expect(component.canImport()).toBe(false);
    component.confirmImport();
    expect(importService.commit).not.toHaveBeenCalled();

    component.setExistingChoice(groupKeyFor(component, 2), '2');
    expect(component.unassignedCount()).toBe(2);
    expect(component.canImport()).toBe(false);

    component.setExistingChoice(groupKeyFor(component, 3), '2');
    component.setExistingChoice(groupKeyFor(component, 4), '1');
    expect(component.canImport()).toBe(true);
    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2 },
      { line: 3, category_id: 2 },
      { line: 4, category_id: 1 },
    ]);
  });

  it('should submit the existing categories chosen for each row', () => {
    const { component } = setup(pendingResponse);
    component.setExistingChoice(groupKeyFor(component, 2), '2');
    component.setExistingChoice(groupKeyFor(component, 3), '2');
    component.setExistingChoice(groupKeyFor(component, 4), '1');

    component.confirmImport();

    expect(importService.commit).toHaveBeenCalledWith('csv', [
      { line: 2, category_id: 2 },
      { line: 3, category_id: 2 },
      { line: 4, category_id: 1 },
    ]);
  });

  it('should only create a new category after the user confirms it', () => {
    const { component } = setup(emptyCategoryResponse);
    const expenseKey = groupKeyFor(component, 2);
    const incomeKey = groupKeyFor(component, 3);
    component.setExistingChoice(expenseKey, '2');
    component.setDraft(incomeKey, '  Stipendio  ');

    expect(component.assignments()).toEqual([{ line: 2, category_id: 2 }]);

    component.confirmNewChoice(incomeKey);

    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2 },
      { line: 3, category: 'Stipendio' },
    ]);
    expect(component.canImport()).toBe(true);

    component.confirmImport();
    expect(importService.commit).toHaveBeenCalledWith('csv', [
      { line: 2, category_id: 2 },
      { line: 3, category: 'Stipendio' },
    ]);
  });

  it('should ignore a blank new category name', () => {
    const { component } = setup(pendingResponse);
    const key = groupKeyFor(component, 3);
    component.setDraft(key, '   ');
    component.confirmNewChoice(key);

    expect(component.choiceFor(key)).toBeNull();
    expect(component.unassignedCount()).toBe(3);
  });

  it('should let the user change a confirmed choice', () => {
    const { component } = setup(pendingResponse);
    const key = groupKeyFor(component, 3);
    component.setExistingChoice(key, '2');
    component.clearChoice(key);

    expect(component.choiceFor(key)).toBeNull();
    expect(component.canImport()).toBe(false);
  });

  it('should assign one category to every row of the same type', () => {
    const { component } = setup(pendingResponse);
    component.applyExistingToAll('expense', '2');
    component.applyExistingToAll('income', '1');

    expect(component.assignments()).toEqual([
      { line: 2, category_id: 2 },
      { line: 3, category_id: 2 },
      { line: 4, category_id: 1 },
    ]);
    expect(component.canImport()).toBe(true);
  });

  it('should pre-select the category suggested by the backend', () => {
    const { component } = setup(suggestedResponse);
    const key = groupKeyFor(component, 4);

    expect(component.selectedCategoryId(key)).toBe(1);
    expect(component.unassignedCount()).toBe(2);
    expect(component.assignedCategoryName(key)).toBe('Freelance');
    expect(component.assignments()).toEqual([{ line: 4, category_id: 1 }]);
  });

  it('should mark the suggested option in the category select', () => {
    const { component } = setup(suggestedResponse);
    const group = component.groups().find((item) => item.type === 'income')!;

    expect(component.categoryOptionLabel({ id: 1, name: 'Freelance' }, group)).toBe(
      'Freelance (suggested)',
    );
    expect(component.categoryOptionLabel({ id: 9, name: 'Salary' }, group)).toBe('Salary');
  });

  it('should require a choice again when a suggested category is discarded', () => {
    const { component } = setup(suggestedResponse);
    component.applyExistingToAll('expense', '2');

    expect(component.canImport()).toBe(true);

    component.clearChoice(groupKeyFor(component, 4));

    expect(component.canImport()).toBe(false);
    expect(component.unassignedCount()).toBe(1);
  });

  it('should reset the choices when another file is analyzed', () => {
    const { component } = setup(suggestedResponse);
    component.setExistingChoice(groupKeyFor(component, 2), '2');
    component.setDraft(groupKeyFor(component, 3), 'Stipendio');
    component.setNote(groupKeyFor(component, 2), 'changed');

    importService.preview.mockReturnValue(of(suggestedResponse));
    component.runPreview();

    expect(component.drafts()).toEqual({});
    expect(component.noteDrafts()).toEqual({});
    expect(component.noteFor(groupKeyFor(component, 2))).toBe('Bowling');
    expect(component.selectedCategoryId(groupKeyFor(component, 4))).toBe(1);
    expect(component.unassignedCount()).toBe(2);
  });
});