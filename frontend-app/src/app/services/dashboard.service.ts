import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSummary } from '../models/dashboard';

export type DashboardFilters = {
  month?: string;
  scope?: 'month' | 'year';
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(filters?: DashboardFilters): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/dashboard', { params: filters });
  }
}
