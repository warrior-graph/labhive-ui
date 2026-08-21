import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  InviteInfo,
  InviteResponse,
  LabMembership,
  Member,
  MembershipHistory,
} from '../models';

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
    data: Partial<{
      first_name: string;
      last_name: string;
      password: string;
      lattes_url?: string | null;
      orcid?: string | null;
      github_url?: string | null;
    }>,
  ): Observable<Member> {
    return this.http.put<Member>(`${this.api}/members/${memberId}`, data);
  }

  /** Histórico de lab membership do próprio usuário (ou de qualquer membro p/ super-admin). */
  getHistory(memberId: number): Observable<MembershipHistory[]> {
    return this.http.get<MembershipHistory[]>(`${this.api}/members/${memberId}/history`);
  }

  /** Desliga (soft-leave) um membro de um lab (MANAGER_ROLES). */
  leaveMember(labId: number, memberId: number): Observable<LabMembership> {
    return this.http.post<LabMembership>(
      `${this.api}/labs/${labId}/members/${memberId}/leave`,
      {},
    );
  }

  /** Reintegra um membro desligado de um lab (MANAGER_ROLES). */
  rejoinMember(labId: number, memberId: number): Observable<LabMembership> {
    return this.http.post<LabMembership>(
      `${this.api}/labs/${labId}/members/${memberId}/rejoin`,
      {},
    );
  }

  /** Gera um convite por link para um lab (MANAGER_ROLES). */
  createInvite(labId: number, days?: number): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(
      `${this.api}/labs/${labId}/invites`,
      days ? { days } : {},
    );
  }

  /** Resolve um convite público por token (404 se inválido/expirado/usado). */
  getInvite(token: string): Observable<InviteInfo> {
    return this.http.get<InviteInfo>(`${this.api}/invites/${token}`);
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
