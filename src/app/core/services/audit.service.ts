import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditPage } from '../models';

export interface AuditParams {
  action?: string;
  actor_id?: number;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Trilha de auditoria de um laboratório (LabCoordinator ou super-admin). */
  listByLab(labId: number, params: AuditParams = {}): Observable<AuditPage> {
    return this.http.get<AuditPage>(`${this.api}/labs/${labId}/audit`, {
      params: this.#query(params),
    });
  }

  /** Trilha global (super-admin) ou dos laboratórios coordenados. */
  list(params: AuditParams & { lab_id?: number } = {}): Observable<AuditPage> {
    const query = this.#query(params);
    if (params.lab_id != null) query['lab_id'] = String(params.lab_id);
    return this.http.get<AuditPage>(`${this.api}/audit`, { params: query });
  }

  #query(params: AuditParams): Record<string, string> {
    const query: Record<string, string> = {};
    if (params.action) query['action'] = params.action;
    if (params.actor_id != null) query['actor_id'] = String(params.actor_id);
    if (params.since) query['since'] = params.since;
    if (params.until) query['until'] = params.until;
    if (params.limit != null) query['limit'] = String(params.limit);
    if (params.offset != null) query['offset'] = String(params.offset);
    return query;
  }
}
