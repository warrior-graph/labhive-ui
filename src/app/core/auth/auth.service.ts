import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppContext, AuthResponse, LabCapability, LoginRequest, Member, RegisterRequest, WorkspaceMembership } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  readonly currentUser = signal<Member | null>(null);
  readonly context = signal<AppContext | null>(null);
  readonly activeLabId = signal<number | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isInitialized = signal(false);
  readonly memberships = computed(() => this.context()?.memberships ?? []);
  readonly activeMembership = computed<WorkspaceMembership | null>(() =>
    this.memberships().find(m => m.lab_id === this.activeLabId()) ?? null,
  );

  constructor() {
    if (localStorage.getItem('access_token')) this.loadContext();
    else this.isInitialized.set(true);
  }

  loadContext(): void {
    this.http.get<AppContext>(`${this.api}/auth/context`).subscribe({
      next: context => {
        this.acceptContext(context);
        this.isInitialized.set(true);
      },
      error: () => {
        this.clearSession();
        this.isInitialized.set(true);
      },
    });
  }

  selectLab(labId: number): void {
    if (!this.memberships().some(m => m.lab_id === labId)) return;
    this.activeLabId.set(labId);
    localStorage.setItem('active_lab_id', String(labId));
  }

  hasCapability(capability: LabCapability): boolean {
    return this.activeMembership()?.capabilities.includes(capability) ?? false;
  }

  hasGlobalCapability(capability: string): boolean {
    return this.context()?.global_capabilities.includes(capability) ?? false;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.clearSession();
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, credentials).pipe(
      tap(res => { if (res.access_token && res.member) this.acceptSession(res); }),
    );
  }

  verifyMfa(token: string, code: string): Observable<AuthResponse> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<AuthResponse>(`${this.api}/auth/mfa/verify`, { code }, { headers })
      .pipe(tap(res => this.acceptSession(res)));
  }

  setupMfa(token: string) {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ secret: string; otpauth_uri: string }>(`${this.api}/auth/mfa/setup`, {}, { headers });
  }

  confirmMfa(token: string, code: string) {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ enabled: boolean; recovery_codes: string[] }>(`${this.api}/auth/mfa/confirm`, { code }, { headers });
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/register`, data).pipe(
      tap(res => {
        if (res.access_token && res.member && !this.isAuthenticated()) this.acceptSession(res);
      }),
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private acceptSession(response: AuthResponse): void {
    if (!response.access_token || !response.member) return;
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token ?? '');
    this.currentUser.set(response.member);
    this.loadContext();
  }

  private acceptContext(context: AppContext): void {
    this.context.set(context);
    this.currentUser.set(context.member);
    const saved = Number(localStorage.getItem('active_lab_id'));
    const active = context.memberships.some(m => m.lab_id === saved) ? saved : context.suggested_lab_id;
    this.activeLabId.set(active);
    if (active != null) localStorage.setItem('active_lab_id', String(active));
    else localStorage.removeItem('active_lab_id');
  }

  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.currentUser.set(null);
    this.context.set(null);
    this.activeLabId.set(null);
  }
}
