import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DashboardSummary } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.api}/dashboard/summary`);
  }
}
