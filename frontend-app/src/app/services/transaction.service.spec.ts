import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list transactions with query params', () => {
    service.list({ type: 'expense', date_from: '2026-07-01', date_to: '2026-07-31', sort_dir: 'asc' })
      .subscribe((res) => {
        expect(res.total).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/transactions' &&
        r.params.get('type') === 'expense' &&
        r.params.get('date_from') === '2026-07-01' &&
        r.params.get('date_to') === '2026-07-31' &&
        r.params.get('sort_dir') === 'asc'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ transactions: [{ id: 1 }], total: 1 });
  });

  it('should create a transaction', () => {
    service
      .create({ type: 'expense', category_id: 2, amount: 10.5, date: '2026-07-01' })
      .subscribe((t) => {
        expect(t.id).toBe(4);
      });

    const req = httpMock.expectOne('/api/transactions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      type: 'expense',
      category_id: 2,
      amount: 10.5,
      date: '2026-07-01',
    });
    req.flush({ id: 4 });
  });

  it('should update and delete a transaction', () => {
    service.update(1, { type: 'income', category_id: 2, amount: 100, date: '2026-07-01' }).subscribe();
    httpMock.expectOne('/api/transactions/1').flush({});

    service.delete(1).subscribe();
    const req = httpMock.expectOne('/api/transactions/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
