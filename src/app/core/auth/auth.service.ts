import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, Member, RegisterRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  readonly currentUser = signal<Member | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isInitialized = signal(false);

  constructor() {
    if (localStorage.getItem('access_token')) {
      this.http.get<Member>(`${this.api}/auth/me`).subscribe({
        next: (member) => {
          this.currentUser.set(member);
          this.isInitialized.set(true);
        },
        error: () => this.isInitialized.set(true),
      });
    } else {
      this.isInitialized.set(true);
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.clearSession();
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, credentials).pipe(
      tap((res) => {
        if (res.access_token && res.member) this.acceptSession(res);
      }),
    );
  }

  verifyMfa(token: string, code: string): Observable<AuthResponse> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http
      .post<AuthResponse>(`${this.api}/auth/mfa/verify`, { code }, { headers })
      .pipe(tap((res) => this.acceptSession(res)));
  }

  setupMfa(token: string) {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ secret: string; otpauth_uri: string }>(
      `${this.api}/auth/mfa/setup`,
      {},
      { headers },
    );
  }

  confirmMfa(token: string, code: string) {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ enabled: boolean; recovery_codes: string[] }>(
      `${this.api}/auth/mfa/confirm`,
      { code },
      { headers },
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/register`, data).pipe(
      tap((res) => {
        // Only take over the session when tokens are present (bootstrap or admin-created)
        if (res.access_token && res.member && !this.isAuthenticated()) {
          localStorage.setItem('access_token', res.access_token);
          localStorage.setItem('refresh_token', res.refresh_token ?? '');
          this.currentUser.set(res.member);
        }
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
  }

  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.currentUser.set(null);
  }
}
