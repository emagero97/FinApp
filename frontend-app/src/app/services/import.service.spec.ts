import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ImportService } from './import.service';

describe('ImportService', () => {
  let service: ImportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should post content to preview', () => {
    const content = 'data;categoria;importo;note\n2026-01-02;Svago;-15.0;Bowling';
    service.preview(content).subscribe((res) => expect(res.total).toBe(1));

    const req = httpMock.expectOne((r) => r.url === '/api/import' && r.method === 'POST');
    expect(req.request.body).toEqual({ content });
    req.flush({ total: 1, invalid: 0, pending: 1, resolved: 0, rows: [], invalid_rows: [], summary_months: [], summary_years: [], category_options: { income: [], expense: [] } });
  });

  it('should post content and assignments to commit', () => {
    service
      .commit('csv', [{ line: 3, category_id: 7 }])
      .subscribe((res) => expect(res.inserted).toBe(2));

    const req = httpMock.expectOne((r) => r.url === '/api/import/commit' && r.method === 'POST');
    expect(req.request.body).toEqual({
      content: 'csv',
      assignments: [{ line: 3, category_id: 7 }],
    });
    req.flush({ inserted: 2, categories_created: ['Svago'] });
  });

  it('should send an empty assignment list by default', () => {
    service.commit('csv').subscribe((res) => expect(res.inserted).toBe(0));

    const req = httpMock.expectOne((r) => r.url === '/api/import/commit' && r.method === 'POST');
    expect(req.request.body).toEqual({ content: 'csv', assignments: [] });
    req.flush({ inserted: 0, categories_created: [] });
  });
});