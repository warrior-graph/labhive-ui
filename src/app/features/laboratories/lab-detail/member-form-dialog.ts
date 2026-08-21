import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { CompensationType, Member } from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { RoleService } from '../../../core/services/role.service';

export interface MemberFormData {
  labId: number;
  requesterRoleLevel: number;
}

@Component({
  selector: 'app-member-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './member-form-dialog.html',
})
export class MemberFormDialog implements OnInit {
  readonly dialogRef = inject(MatDialogRef<MemberFormDialog>);
  readonly data = inject<MemberFormData>(MAT_DIALOG_DATA);
  private readonly memberService = inject(MemberService);
  private readonly roleService = inject(RoleService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly lookupLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly foundMember = signal<Member | null>(null);
  protected readonly lookupError = signal<string | null>(null);
  protected readonly roles = signal<{ value: string; label: string }[]>([]);

  protected readonly compensationTypes = [
    { value: CompensationType.PROJECT_SALARY, label: 'Salário de projeto' },
    { value: CompensationType.RESEARCH_GRANT, label: 'Bolsa de pesquisa' },
    { value: CompensationType.VOLUNTEER, label: 'Voluntário' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    cpf: ['', Validators.required],
    roles: [[] as string[], Validators.required],
    specialization: ['' as string],
    compensation_type: ['' as string],
    compensation_value: [null as number | null],
  });

  ngOnInit(): void {
    this.roleService.list().subscribe({
      next: all => {
        const filtered = all
          .filter(r => r.level > this.data.requesterRoleLevel)
          .map(r => ({ value: r.key, label: r.name }));
        this.roles.set(filtered);
        if (filtered.length) {
          this.form.get('roles')!.setValue([filtered[filtered.length - 1].value]);
        }
      },
    });
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
    this.foundMember.set(null);
    this.lookupError.set(null);
    if (digits.length === 11) {
      this.lookupMember(digits);
    }
  }

  private lookupMember(cpf: string): void {
    this.lookupLoading.set(true);
    this.memberService.lookupByCpf(cpf).subscribe({
      next: member => {
        this.foundMember.set(member);
        this.lookupError.set(null);
        this.lookupLoading.set(false);
      },
      error: () => {
        this.foundMember.set(null);
        this.lookupError.set('Nenhum membro encontrado com este CPF. Crie a conta dele(a) primeiro pela página de Cadastro.');
        this.lookupLoading.set(false);
      },
    });
  }

  protected submit(): void {
    const member = this.foundMember();
    if (!member || this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { roles, specialization, compensation_type, compensation_value } =
      this.form.getRawValue();
    this.memberService
      .addMember(this.data.labId, {
        member_id: member.id,
        roles,
        ...(specialization && { specialization }),
        ...(compensation_type && { compensation_type }),
        ...(compensation_value != null && { compensation_value }),
      })
      .subscribe({
        next: membership => this.dialogRef.close(membership),
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message ?? 'Falha ao adicionar membro.');
          this.loading.set(false);
        },
      });
  }
}
