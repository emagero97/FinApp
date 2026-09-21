import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, Observable } from 'rxjs';
import { ImportPageComponent } from './import-page.component';
import { ImportService } from '../services/import.service';
import { ImportPreview } from '../models/import';

const previewResponse: ImportPreview = {
  total: 2,
  invalid: 1,
  rows: [
    { line: 2, date: '2026-01-02', category: 'Svago', type: 'expense', amount: -15, notes: 'Bowling' },
    { line: 3, date: '2026-01-03', category: 'Veicoli', type: 'expense', amount: -40, notes: 'benzina' },
  ],
  invalid_rows: [{ line: 4, errors: ['Date must use the format YYYY-MM-DD'] }],
  new_categories: [
    { name: 'Svago', type: 'expense' },
    { name: 'Veicoli', type: 'expense' },
  ],
  summary_months: [{ month: '2026-01', count: 2, income: 0, expenses: -55, total: -55 }],
  summary_years: [{ year: '2026', count: 2, income: 0, expenses: -55, total: -55 }],
};

describe('ImportPageComponent', () => {
  let importService: {
    preview: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };

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
    expect(component.preview()?.new_categories.length).toBe(2);
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
    expect(el.textContent).toContain('Svago');
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

  it('should block import when missing categories are not approved', () => {
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    component.createCategories.set(false);

    expect(component.canImport()).toBe(false);
    component.confirmImport();
    expect(importService.commit).not.toHaveBeenCalled();
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
    const fixture = TestBed.createComponent(ImportPageComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.content.set('csv');
    component.runPreview();
    fixture.detectChanges();
    component.confirmImport();
    fixture.detectChanges();

    expect(importService.commit).toHaveBeenCalledWith('csv', true);
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
});