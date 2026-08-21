import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ActivityDetail,
  CalendarEvent,
  CreateActivityPayload,
  DashboardActivityItem,
  DashboardInventoryItem,
  DashboardProjectItem,
  DashboardSummary,
  UpdateActivityPayload,
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

  getCalendarEvents(month?: string): Observable<CalendarEvent[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    return this.http.get<CalendarEvent[]>(`${this.api}/calendar`, { params });
  }

  getActivity(labId: number, activityId: number): Observable<ActivityDetail> {
    return this.http.get<ActivityDetail>(
      `${this.api}/labs/${labId}/activities/${activityId}`,
    );
  }

  createActivity(
    labId: number,
    data: CreateActivityPayload,
  ): Observable<ActivityDetail> {
    return this.http.post<ActivityDetail>(
      `${this.api}/labs/${labId}/activities`,
      data,
    );
  }

  updateActivity(
    labId: number,
    activityId: number,
    data: UpdateActivityPayload,
  ): Observable<ActivityDetail> {
    return this.http.put<ActivityDetail>(
      `${this.api}/labs/${labId}/activities/${activityId}`,
      data,
    );
  }

  deleteActivity(labId: number, activityId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/labs/${labId}/activities/${activityId}`,
    );
  }

  reviewActivity(
    labId: number,
    activityId: number,
    decision: 'accepted' | 'rejected',
  ): Observable<ActivityDetail> {
    return this.http.post<ActivityDetail>(
      `${this.api}/labs/${labId}/activities/${activityId}/review`,
      { decision },
    );
  }
}
