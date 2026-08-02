import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExportService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should preview with query params', () => {
    service
      .preview({ type: 'expense', month: '2026-07' })
      .subscribe((res) => expect(res.count).toBe(3));

    const req = httpMock.expectOne(
      (r) => r.url === '/api/export' && r.method === 'GET' && r.params.get('month') === '2026-07'
    );
    req.flush({ count: 3 });
  });

  it('should omit the type param when both is selected', () => {
    service
      .preview({ type: 'both', year: 2026 })
      .subscribe((res) => expect(res.count).toBe(5));

    const req = httpMock.expectOne(
      (r) => r.url === '/api/export' && r.params.get('year') === '2026' && r.params.get('type') === null
    );
    req.flush({ count: 5 });
  });

  it('should send categories as comma-separated ids', () => {
    service
      .preview({ include_category_ids: [1, 3], exclude_category_ids: [2] })
      .subscribe();

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/export' &&
        r.params.get('include_category_ids') === '1,3' &&
        r.params.get('exclude_category_ids') === '2'
    );
    req.flush({ count: 1 });
  });

  it('should send multiple months joined by comma', () => {
    service.preview({ months: ['2026-06', '2026-07'] }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/export' && r.params.get('months') === '2026-06,2026-07'
    );
    req.flush({ count: 2 });
  });

  it('should download as blob with response', () => {
    service
      .download({ type: 'expense' })
      .subscribe((res) => expect(res.body?.size).toBe(4));

    const req = httpMock.expectOne(
      (r) => r.url === '/api/export/download' && r.params.get('type') === 'expense'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['data'], { type: 'text/csv' }));
  });
});