import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatCardActions } from '@angular/material/card';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import QRCode from 'qrcode';

import { AuthService } from '../../../core/auth/auth.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    MatProgressSpinner,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stage = signal<'credentials' | 'verify' | 'enroll' | 'recovery'>(
    'credentials',
  );
  protected readonly challengeToken = signal('');
  protected readonly qrCode = signal('');
  protected readonly manualSecret = signal('');
  protected readonly recoveryCodes = signal<string[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{6,20}$/)]],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.mfa_required && response.mfa_token) {
          this.challengeToken.set(response.mfa_token);
          this.stage.set('verify');
          return;
        }
        if (response.mfa_enrollment_required && response.enrollment_token) {
          this.challengeToken.set(response.enrollment_token);
          this.startEnrollment(response.enrollment_token);
          return;
        }
        this.router.navigate(['/labs']);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.error.set(
            'Sua conta está aguardando aprovação pelo professor do laboratório. Tente novamente depois que for aprovado(a).',
          );
        } else {
          this.error.set(extractApiError(err, 'Falha no login. Tente novamente.'));
        }
        this.loading.set(false);
      },
    });
  }

  protected submitCode(): void {
    if (this.codeForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const code = this.codeForm.getRawValue().code.trim();
    if (this.stage() === 'verify') {
      this.authService.verifyMfa(this.challengeToken(), code).subscribe({
        next: () => this.router.navigate(['/labs']),
        error: (err) => this.handleCodeError(err),
      });
      return;
    }
    this.authService.confirmMfa(this.challengeToken(), code).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.recoveryCodes.set(response.recovery_codes);
        this.stage.set('recovery');
      },
      error: (err) => this.handleCodeError(err),
    });
  }

  protected finishEnrollment(): void {
    this.form.reset();
    this.codeForm.reset();
    this.stage.set('credentials');
    this.error.set('Verificação em duas etapas ativada. Entre novamente para continuar.');
  }

  protected backToLogin(): void {
    this.stage.set('credentials');
    this.challengeToken.set('');
    this.codeForm.reset();
    this.error.set(null);
  }

  private startEnrollment(token: string): void {
    this.stage.set('enroll');
    this.loading.set(true);
    this.authService.setupMfa(token).subscribe({
      next: async (setup) => {
        this.manualSecret.set(setup.secret);
        this.qrCode.set(await QRCode.toDataURL(setup.otpauth_uri, { width: 220, margin: 1 }));
        this.loading.set(false);
      },
      error: (err) => this.handleCodeError(err),
    });
  }

  private handleCodeError(err: HttpErrorResponse): void {
    this.error.set(extractApiError(err, 'Código inválido ou expirado.'));
    this.loading.set(false);
  }
}
