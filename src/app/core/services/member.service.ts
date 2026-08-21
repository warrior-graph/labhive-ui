import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LabMembership, Member } from '../models';

export interface AddMemberPayload {
  member_id: number;
  roles: string[];
  compensation_type?: string;
  compensation_value?: number;
}

export interface OrgChartResponse {
  root_id: number | null;
  memberships: LabMembership[];
}

export interface UpdateMembershipPayload {
  roles?: string[];
  specialization?: string | null;
  compensation_type?: string | null;
  compensation_value?: number | null;
  reports_to_id?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getMemberById(memberId: number): Observable<Member> {
    return this.http.get<Member>(`${this.api}/members/${memberId}`);
  }

  getLabMembers(labId: number): Observable<LabMembership[]> {
    return this.http.get<LabMembership[]>(`${this.api}/labs/${labId}/members`);
  }

  getOrg(labId: number): Observable<OrgChartResponse> {
    return this.http.get<OrgChartResponse>(`${this.api}/labs/${labId}/org`);
  }

  addMember(labId: number, data: AddMemberPayload): Observable<LabMembership> {
    return this.http.post<LabMembership>(`${this.api}/labs/${labId}/members`, data);
  }

  getMember(labId: number, memberId: number): Observable<LabMembership> {
    return this.http.get<LabMembership>(
      `${this.api}/labs/${labId}/members/${memberId}`,
    );
  }

  updateMembership(
    labId: number,
    memberId: number,
    data: UpdateMembershipPayload,
  ): Observable<LabMembership> {
    return this.http.put<LabMembership>(
      `${this.api}/labs/${labId}/members/${memberId}`,
      data,
    );
  }

  removeMember(labId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/labs/${labId}/members/${memberId}`,
    );
  }

  updateProfile(
    memberId: number,
    data: Partial<{ first_name: string; last_name: string; password: string }>,
  ): Observable<Member> {
    return this.http.put<Member>(`${this.api}/members/${memberId}`, data);
  }

  lookupByCpf(cpf: string): Observable<Member> {
    return this.http.get<Member>(`${this.api}/members/lookup`, {
      params: { cpf },
    });
  }

  getPendingMembers(): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.api}/members/pending`);
  }

  getAllMembers(): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.api}/members`);
  }

  approveMember(memberId: number): Observable<Member> {
    return this.http.post<Member>(`${this.api}/members/${memberId}/approve`, {});
  }

  deactivateMember(memberId: number): Observable<Member> {
    return this.http.post<Member>(`${this.api}/members/${memberId}/deactivate`, {});
  }

  activateMember(memberId: number): Observable<Member> {
    return this.http.post<Member>(`${this.api}/members/${memberId}/activate`, {});
  }

  debugResetDb(): Observable<{ ok: boolean; stdout?: string }> {
    return this.http.post<{ ok: boolean; stdout?: string }>(`${this.api}/debug/reset-db`, {});
  }
}
