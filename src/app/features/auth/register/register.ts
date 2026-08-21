import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatCardActions } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';

import { AuthService } from '../../../core/auth/auth.service';
import { InviteInfo } from '../../../core/models';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { MemberService } from '../../../core/services/member.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardActions,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatIcon,
    MatInput,
    MatOption,
    MatButton,
    MatProgressSpinner,
    MatSelect,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly labService = inject(LaboratoryService);
  private readonly memberService = inject(MemberService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successEmail = signal<string | null>(null);
  protected readonly pendingApproval = signal(false);
  protected readonly labs = signal<{ id: number; name: string }[]>([]);
  protected readonly inviteToken = signal<string | null>(null);
  protected readonly inviteInfo = signal<InviteInfo | null>(null);
  protected readonly inviteError = signal<string | null>(null);
  protected readonly inviteLoading = signal(false);

  protected readonly isSuperAdmin = computed(
    () => this.authService.currentUser()?.is_super_admin === true,
  );
  protected readonly isLoggedIn = computed(() => this.authService.isAuthenticated());

  protected readonly form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    cpf: ['', [Validators.required, Validators.pattern(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    desired_lab_id: [null as number | null],
    is_professor: [false],
  });

  ngOnInit(): void {
    // Load public lab list for self-registration lab picker
    if (!this.isLoggedIn()) {
      this.labService.getDirectory().subscribe({
        next: labs => this.labs.set(labs),
        error: () => {},
      });
    }

    // Resolve ?invite= token (public endpoint)
    const token = this.route.snapshot.queryParamMap.get('invite');
    if (token) {
      this.inviteToken.set(token);
      this.inviteLoading.set(true);
      this.memberService.getInvite(token).subscribe({
        next: info => {
          this.inviteInfo.set(info);
          this.inviteLoading.set(false);
        },
        error: () => {
          this.inviteError.set('Convite inválido ou expirado.');
          this.inviteLoading.set(false);
        },
      });
    }
  }

  protected onCpfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 9) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    input.value = formatted;
    this.form.get('cpf')!.setValue(formatted, { emitEvent: false });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.successEmail.set(null);

    const { cpf: rawCpf, is_professor, desired_lab_id, ...rest } = this.form.getRawValue();
    const cpfDigits = rawCpf ? rawCpf.replace(/\D/g, '') : '';

    const payload: Record<string, unknown> = { ...rest, cpf: cpfDigits };

    if (!this.isLoggedIn() && desired_lab_id && !this.inviteToken()) {
      payload['desired_lab_id'] = desired_lab_id;
    }
    if (is_professor) {
      payload['is_professor'] = true;
    }
    // Invite-based registration: backend auto-approves and adds to the lab
    if (this.inviteToken()) {
      payload['invite_token'] = this.inviteToken();
    }

    this.authService.register(payload as never).subscribe({
      next: res => {
        if (res.access_token) {
          if (this.isLoggedIn()) {
            // Professor/admin created a member — stay on page
            this.successEmail.set(res.member.email);
            this.form.reset({ is_professor: false });
          } else {
            // Bootstrap — navigate to labs
            this.router.navigate(['/labs']);
          }
        } else {
          // Self-registration — pending approval
          this.pendingApproval.set(true);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extractApiError(err, 'Registration failed. Please try again.'));
        this.loading.set(false);
      },
    });
  }
}
