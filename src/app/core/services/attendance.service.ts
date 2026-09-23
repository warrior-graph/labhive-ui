import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AttendanceDashboardData, AttendanceGranularity } from '../models';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getDashboard(
    labId: number,
    granularity: AttendanceGranularity,
    periods: number,
  ): Observable<AttendanceDashboardData> {
    const params = new HttpParams()
      .set('granularity', granularity)
      .set('periods', periods);
    return this.http.get<AttendanceDashboardData>(
      `${this.api}/labs/${labId}/attendance`,
      { params },
    );
  }

  updateTarget(
    labId: number,
    memberId: number,
    weeklyTargetHours: number | null,
  ): Observable<{ member_id: number; weekly_target_minutes: number | null }> {
    return this.http.put<{ member_id: number; weekly_target_minutes: number | null }>(
      `${this.api}/labs/${labId}/attendance/members/${memberId}/target`,
      { weekly_target_hours: weeklyTargetHours },
    );
  }
}
