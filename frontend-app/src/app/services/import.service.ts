import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ImportCategoryAssignment,
  ImportCommitResult,
  ImportPreview,
} from '../models/import';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/import';

  preview(content: string): Observable<ImportPreview> {
    return this.http.post<ImportPreview>(this.baseUrl, { content });
  }

  commit(
    content: string,
    assignments: ImportCategoryAssignment[] = [],
  ): Observable<ImportCommitResult> {
    return this.http.post<ImportCommitResult>(`${this.baseUrl}/commit`, {
      content,
      assignments,
    });
  }
}