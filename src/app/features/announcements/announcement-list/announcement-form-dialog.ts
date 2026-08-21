import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
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
  Announcement,
  LAB_ROLE_LABELS,
  Laboratory,
} from '../../../core/models';
import { AnnouncementsService } from '../../../core/services/announcements.service';
import { extractApiError } from '../../../core/utils/api-error';

export interface AnnouncementFormData {
  labs: Laboratory[];
  announcement: Announcement | null;
}

@Component({
  selector: 'app-announcement-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatCheckbox,
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
  templateUrl: './announcement-form-dialog.html',
  styles: [
    `
    .announcement-form {
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
    .pin-check {
      margin: 8px 0 4px;
    }
    `,
  ],
})
export class AnnouncementFormDialog {
  readonly dialogRef = inject(MatDialogRef<AnnouncementFormDialog>);
  readonly data = inject<AnnouncementFormData>(MAT_DIALOG_DATA);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Papéis disponíveis para o público-alvo (vazio = todos). */
  protected readonly roles = Object.entries(LAB_ROLE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly form = this.fb.nonNullable.group({
    title: [this.data.announcement?.title ?? '', Validators.required],
    body: [this.data.announcement?.body ?? ''],
    lab_id: [
      this.data.announcement?.lab_id ?? (null as number | null),
      Validators.required,
    ],
    audience: [this.data.announcement?.audience ?? ([] as string[])],
    is_pinned: [this.data.announcement?.is_pinned ?? false],
  });

  get isEdit(): boolean {
    return !!this.data.announcement;
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();

    if (this.data.announcement) {
      this.announcementsService
        .updateAnnouncement(this.data.announcement.id, {
          title: raw.title,
          body: raw.body,
          audience: raw.audience,
          is_pinned: raw.is_pinned,
        })
        .subscribe({
          next: updated => this.dialogRef.close(updated),
          error: (err: HttpErrorResponse) => {
            this.error.set(extractApiError(err, 'Falha ao atualizar aviso.'));
            this.loading.set(false);
          },
        });
      return;
    }

    if (!raw.lab_id) {
      this.error.set('Selecione um laboratório.');
      this.loading.set(false);
      return;
    }
    this.announcementsService
      .createAnnouncement({
        lab_id: raw.lab_id,
        title: raw.title,
        body: raw.body,
        audience: raw.audience,
        is_pinned: raw.is_pinned,
      })
      .subscribe({
        next: created => this.dialogRef.close(created),
        error: (err: HttpErrorResponse) => {
          this.error.set(extractApiError(err, 'Falha ao criar aviso.'));
          this.loading.set(false);
        },
      });
  }
}
