import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list categories with query params', () => {
    service
      .list({ search: 'gro', type: 'expense', status: 'enabled', sortBy: 'name', sortDir: 'desc' })
      .subscribe((res) => {
        expect(res.total).toBe(1);
        expect(res.categories[0].name).toBe('Groceries');
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === '/api/categories' &&
        r.params.get('search') === 'gro' &&
        r.params.get('type') === 'expense' &&
        r.params.get('status') === 'enabled' &&
        r.params.get('sort_by') === 'name' &&
        r.params.get('sort_dir') === 'desc'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ categories: [{ id: 1, name: 'Groceries' }], total: 1 });
  });

  it('should create a category', () => {
    service.create({ name: 'Salary', type: 'income', status: 'enabled' }).subscribe((c) => {
      expect(c.id).toBe(7);
    });

    const req = httpMock.expectOne('/api/categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Salary', type: 'income', status: 'enabled' });
    req.flush({ id: 7 });
  });

  it('should update a category', () => {
    service.update(1, { name: 'Rent', type: 'expense', status: 'disabled' }).subscribe();

    const req = httpMock.expectOne('/api/categories/1');
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('should delete a category', () => {
    service.delete(3).subscribe();

    const req = httpMock.expectOne('/api/categories/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
