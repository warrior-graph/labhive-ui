import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { OccupancyReport } from '../models';

export interface OccupancyParams {
  since?: string;
  until?: string;
  include_inactive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Relatório de ocupação por espaço e por dia (MANAGER_ROLES). */
  getOccupancy(labId: number, params: OccupancyParams = {}): Observable<OccupancyReport> {
    const query: Record<string, string> = {};
    if (params.since) query['since'] = params.since;
    if (params.until) query['until'] = params.until;
    if (params.include_inactive) query['include_inactive'] = 'true';
    return this.http.get<OccupancyReport>(
      `${this.api}/labs/${labId}/analytics/occupancy`,
      { params: query },
    );
  }
}
