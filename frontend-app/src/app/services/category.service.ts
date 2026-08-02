import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Category,
  CategoryInput,
  CategoryListResponse,
  CategoryQuery,
} from '../models/category';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/categories';

  list(query: CategoryQuery = {}): Observable<CategoryListResponse> {
    let params = new HttpParams();
    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.parentId !== undefined && query.parentId !== null) {
      params = params.set('parent_id', String(query.parentId));
    }
    if (query.sortBy) {
      params = params.set('sort_by', query.sortBy);
    }
    if (query.sortDir) {
      params = params.set('sort_dir', query.sortDir);
    }
    return this.http.get<CategoryListResponse>(this.baseUrl, { params });
  }

  get(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }

  create(input: CategoryInput): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, input);
  }

  update(id: number, input: CategoryInput): Observable<Category> {
    return this.http.put<Category>(`${this.baseUrl}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
