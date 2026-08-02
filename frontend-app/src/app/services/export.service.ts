import { HttpClient, HttpParams } from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ExportPreview, ExportQuery } from '../models/export';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);

  preview(query: ExportQuery): Observable<ExportPreview> {
    return this.http.get<ExportPreview>('/api/export', { params: this.buildParams(query) });
  }

  download(query: ExportQuery): Observable<HttpResponse<Blob>> {
    return this.http.get('/api/export/download', {
      params: this.buildParams(query),
      responseType: 'blob',
      observe: 'response',
    });
  }

  private buildParams(query: ExportQuery): HttpParams {
    let params = new HttpParams();
    if (query.type && query.type !== 'both') {
      params = params.set('type', query.type);
    }
    if (query.date_from) {
      params = params.set('date_from', query.date_from);
    }
    if (query.date_to) {
      params = params.set('date_to', query.date_to);
    }
    if (query.month) {
      params = params.set('month', query.month);
    }
    if (query.months && query.months.length > 0) {
      params = params.set('months', query.months.join(','));
    }
    if (query.year) {
      params = params.set('year', String(query.year));
    }
    if (query.include_category_ids && query.include_category_ids.length > 0) {
      params = params.set('include_category_ids', query.include_category_ids.join(','));
    }
    if (query.exclude_category_ids && query.exclude_category_ids.length > 0) {
      params = params.set('exclude_category_ids', query.exclude_category_ids.join(','));
    }
    if (query.lang) {
      params = params.set('lang', query.lang);
    }
    return params;
  }
}