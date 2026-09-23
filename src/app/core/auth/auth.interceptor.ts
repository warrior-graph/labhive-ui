import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const backend = inject(HttpBackend);

  const isRefreshUrl = req.url.includes('/auth/refresh');
  const hasExplicitAuthorization = req.headers.has('Authorization');
  const token = isRefreshUrl
    ? localStorage.getItem('refresh_token')
    : localStorage.getItem('access_token');

  const authReq =
    token && !hasExplicitAuthorization
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isRefreshUrl) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Use HttpBackend to bypass interceptors for the refresh call
          const http = new HttpClient(backend);
          return http
            .post<{
              access_token: string;
            }>(`${environment.apiUrl}/auth/refresh`, {}, { headers: { Authorization: `Bearer ${refreshToken}` } })
            .pipe(
              switchMap(({ access_token }) => {
                localStorage.setItem('access_token', access_token);
                const retried = req.clone({
                  setHeaders: { Authorization: `Bearer ${access_token}` },
                });
                return next(retried);
              }),
              catchError((refreshErr) => {
                clearTokens();
                router.navigate(['/login']);
                return throwError(() => refreshErr);
              }),
            );
        }
        clearTokens();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
