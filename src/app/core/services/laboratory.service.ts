import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LabMembership, Laboratory } from '../models';

@Injectable({ providedIn: 'root' })
export class LaboratoryService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getAll(): Observable<Laboratory[]> {
    return this.http.get<Laboratory[]>(`${this.api}/labs`);
  }

  getDirectory(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(`${this.api}/labs/directory`);
  }

  getById(id: number): Observable<Laboratory> {
    return this.http.get<Laboratory>(`${this.api}/labs/${id}`);
  }

  create(data: { name: string; description: string }): Observable<Laboratory> {
    return this.http.post<Laboratory>(`${this.api}/labs`, data);
  }

  update(
    id: number,
    data: Partial<{ name: string; description: string }>,
  ): Observable<Laboratory> {
    return this.http.put<Laboratory>(`${this.api}/labs/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/labs/${id}`);
  }

  deactivate(id: number): Observable<Laboratory> {
    return this.http.post<Laboratory>(`${this.api}/labs/${id}/deactivate`, {});
  }

  activate(id: number): Observable<Laboratory> {
    return this.http.post<Laboratory>(`${this.api}/labs/${id}/activate`, {});
  }

  getMembers(labId: number): Observable<LabMembership[]> {
    return this.http.get<LabMembership[]>(`${this.api}/labs/${labId}/members`);
  }
}
