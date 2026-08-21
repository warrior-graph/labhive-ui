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
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import {
  CompensationType,
  LabMembership,
} from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { RoleService } from '../../../core/services/role.service';

export interface EditMemberData {
  labId: number;
  membership: LabMembership;
  requesterRoleLevel: number;
  labMembers: LabMembership[];
}

@Component({
  selector: 'app-edit-member-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  template: `
    <h2 mat-dialog-title>Editar Membro</h2>
    <mat-dialog-content>
      <p class="member-name">
        {{ data.membership.member?.first_name }} {{ data.membership.member?.last_name }}
      </p>

      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Papel</mat-label>
          <mat-select formControlName="roles" multiple>
            @for (r of roles(); track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Especialização</mat-label>
          <input matInput formControlName="specialization" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tipo de remuneração</mat-label>
          <mat-select formControlName="compensation_type">
            <mat-option value="">Nenhum</mat-option>
            @for (ct of compensationTypes; track ct.value) {
              <mat-option [value]="ct.value">{{ ct.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (form.value.compensation_type) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Valor da remuneração</mat-label>
            <input matInput type="number" formControlName="compensation_value" />
          </mat-form-field>
        }

        @if (data.requesterRoleLevel <= 0) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reporta a</mat-label>
            <mat-select formControlName="reports_to_id">
              <mat-option [value]="null">— Padrão (por nível de papel) —</mat-option>
              @for (m of data.labMembers; track m.member_id) {
                <mat-option [value]="m.member_id">
                  {{ m.member?.first_name }} {{ m.member?.last_name }} ({{ m.roles.join(', ') }})
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (error()) {
          <p class="error-msg">{{ error() }}</p>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancelar</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || loading()"
        (click)="submit()"
      >
        @if (loading()) {
          <mat-progress-spinner diameter="18" mode="indeterminate" />
        } @else {
          Salvar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .member-name { font-weight: 500; margin: 0 0 16px; color: var(--mat-sys-on-surface-variant); }
    .full-width { width: 100%; margin-bottom: 20px; }
    .error-msg { color: var(--mat-sys-error); font-size: 14px; margin: 0 0 8px; }
  `],
})
export class EditMemberDialog implements OnInit {
  readonly dialogRef = inject(MatDialogRef<EditMemberDialog>);
  readonly data = inject<EditMemberData>(MAT_DIALOG_DATA);
  private readonly memberService = inject(MemberService);
  private readonly roleService = inject(RoleService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = signal<{ value: string; label: string }[]>([]);

  protected readonly compensationTypes = [
    { value: CompensationType.PROJECT_SALARY, label: 'Salário de projeto' },
    { value: CompensationType.RESEARCH_GRANT, label: 'Bolsa de pesquisa' },
    { value: CompensationType.VOLUNTEER, label: 'Voluntário' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    roles: [this.data.membership.roles ?? [] as string[], Validators.required],
    specialization: [this.data.membership.specialization ?? ''],
    compensation_type: [this.data.membership.compensation_type ?? ''],
    compensation_value: [this.data.membership.compensation_value as number | null],
    reports_to_id: [this.data.membership.reports_to_id ?? null as number | null],
  });

  ngOnInit(): void {
    this.roleService.list().subscribe({
      next: all => {
        const filtered = all
          .filter(r => r.level > this.data.requesterRoleLevel)
          .map(r => ({ value: r.key, label: r.name }));
        this.roles.set(filtered);
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { roles, specialization, compensation_type, compensation_value, reports_to_id } =
      this.form.getRawValue();
    this.memberService
      .updateMembership(this.data.labId, this.data.membership.member_id, {
        roles,
        specialization: specialization || null,
        compensation_type: compensation_type || null,
        compensation_value: compensation_type ? compensation_value : null,
        ...(this.data.requesterRoleLevel <= 0 && { reports_to_id: reports_to_id ?? null }),
      })
      .subscribe({
        next: updated => this.dialogRef.close(updated),
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message ?? 'Falha ao atualizar membro.');
          this.loading.set(false);
        },
      });
  }
}
