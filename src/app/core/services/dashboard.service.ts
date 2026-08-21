import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DashboardActivityItem,
  DashboardInventoryItem,
  DashboardProjectItem,
  DashboardSummary,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.api}/dashboard/summary`);
  }

  getActivities(status?: string): Observable<DashboardActivityItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<DashboardActivityItem[]>(`${this.api}/dashboard/activities`, { params });
  }

  getProjects(status?: string): Observable<DashboardProjectItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<DashboardProjectItem[]>(`${this.api}/dashboard/projects`, { params });
  }

  getInventory(): Observable<DashboardInventoryItem[]> {
    return this.http.get<DashboardInventoryItem[]>(`${this.api}/dashboard/inventory`);
  }
}
