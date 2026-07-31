import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch the dashboard summary', () => {
    service.get().subscribe((summary) => {
      expect(summary.periods.month.income).toBe('2500.00');
    });

    const req = httpMock.expectOne('/api/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({ periods: { month: { income: '2500.00' } } });
  });
});
