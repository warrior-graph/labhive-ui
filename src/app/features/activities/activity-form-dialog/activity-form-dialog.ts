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
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';

import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  ActivityDetail,
  ActivityStatus,
  CreateActivityPayload,
  LabMembership,
  Laboratory,
} from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';
import { MemberService } from '../../../core/services/member.service';
import { extractApiError } from '../../../core/utils/api-error';

export interface ActivityFormData {
  labId: number | null;
  activity?: ActivityDetail | null;
  labs?: Laboratory[];
}

@Component({
  selector: 'app-activity-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatOption,
    MatProgressSpinner,
    MatSelect,
  ],
  templateUrl: './activity-form-dialog.html',
  styles: [
    `
    .activity-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-error {
      margin-bottom: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      background: var(--sem-error-bg);
      color: var(--sem-error-fg);
    }
    mat-form-field {
      width: 100%;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    `,
  ],
})
export class ActivityFormDialog implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ActivityFormDialog>);
  readonly data = inject<ActivityFormData>(MAT_DIALOG_DATA);
  private readonly dashboardService = inject(DashboardService);
  private readonly memberService = inject(MemberService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly members = signal<LabMembership[]>([]);
  protected readonly membersLoading = signal(false);

  protected readonly statuses = ACTIVITY_STATUSES;

  protected readonly form = this.fb.nonNullable.group({
    title: [this.data.activity?.title ?? '', Validators.required],
    activity_type: [this.data.activity?.activity_type ?? ''],
    description: [this.data.activity?.description ?? ''],
    venue: [this.data.activity?.venue ?? ''],
    reference_link: [this.data.activity?.reference_link ?? ''],
    status: [this.data.activity?.status ?? 'planned'],
    deadline: [
      this.data.activity?.deadline ? this.data.activity.deadline.slice(0, 10) : '',
    ],
    lab_id: [
      this.data.activity?.lab_id ?? this.data.labId ?? (null as number | null),
      Validators.required,
    ],
    in_charge: [
      this.data.activity?.in_charge.map(p => p.id) ?? ([] as number[]),
    ],
    participants: [
      this.data.activity?.participants.map(p => p.id) ?? ([] as number[]),
    ],
  });

  get isEdit(): boolean {
    return !!this.data.activity;
  }

  ngOnInit(): void {
    const labId = this.data.activity?.lab_id ?? this.data.labId;
    if (this.isEdit) {
      if (labId) this.loadMembers(labId);
      return;
    }
    // Criação: carregar membros sempre que o laboratório mudar.
    this.form.controls.lab_id.valueChanges.subscribe(id => {
      if (id) this.loadMembers(id);
    });
    if (labId) this.loadMembers(labId);
  }

  protected statusLabel(status: string): string {
    return (
      ACTIVITY_STATUS_LABELS[status as ActivityStatus] ??
      status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    );
  }

  protected memberName(m: LabMembership): string {
    const p = m.member;
    return p
      ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      : `Member #${m.member_id}`;
  }

  private loadMembers(labId: number): void {
    this.membersLoading.set(true);
    this.memberService.getLabMembers(labId).subscribe({
      next: list => {
        this.members.set(list);
        this.membersLoading.set(false);
      },
      error: () => {
        this.members.set([]);
        this.membersLoading.set(false);
        this.error.set('Falha ao carregar membros do laboratório.');
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    const labId = raw.lab_id;
    if (!labId) {
      this.error.set('Selecione um laboratório.');
      this.loading.set(false);
      return;
    }

    const payload: CreateActivityPayload = {
      title: raw.title.trim(),
      activity_type: raw.activity_type?.trim() || null,
      description: raw.description?.trim() || null,
      venue: raw.venue?.trim() || null,
      reference_link: raw.reference_link?.trim() || null,
      status: raw.status,
      deadline: raw.deadline || null,
      in_charge: raw.in_charge,
      participants: raw.participants,
    };

    if (this.data.activity) {
      this.dashboardService
        .updateActivity(labId, this.data.activity.id, payload)
        .subscribe({
          next: updated => this.dialogRef.close(updated),
          error: (err: HttpErrorResponse) => {
            this.error.set(extractApiError(err, 'Falha ao atualizar atividade.'));
            this.loading.set(false);
          },
        });
      return;
    }

    this.dashboardService.createActivity(labId, payload).subscribe({
      next: created => this.dialogRef.close(created),
      error: (err: HttpErrorResponse) => {
        this.error.set(extractApiError(err, 'Falha ao criar atividade.'));
        this.loading.set(false);
      },
    });
  }
}