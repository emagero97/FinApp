import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Transaction,
  TransactionInput,
  TransactionListResponse,
  TransactionQuery,
} from '../models/transaction';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/transactions';

  list(query: TransactionQuery = {}): Observable<TransactionListResponse> {
    let params = new HttpParams();
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.category_id) {
      params = params.set('category_id', query.category_id);
    }
    if (query.date_from) {
      params = params.set('date_from', query.date_from);
    }
    if (query.date_to) {
      params = params.set('date_to', query.date_to);
    }
    if (query.search) {
      params = params.set('search', query.search);
    }
    if (query.sort_by) {
      params = params.set('sort_by', query.sort_by);
    }
    if (query.sort_dir) {
      params = params.set('sort_dir', query.sort_dir);
    }
    return this.http.get<TransactionListResponse>(this.baseUrl, { params });
  }

  get(id: number): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.baseUrl}/${id}`);
  }

  create(input: TransactionInput): Observable<Transaction> {
    return this.http.post<Transaction>(this.baseUrl, input);
  }

  update(id: number, input: TransactionInput): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.baseUrl}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
