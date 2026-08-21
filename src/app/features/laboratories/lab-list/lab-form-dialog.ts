import { Component, inject, signal } from '@angular/core';
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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { Laboratory } from '../../../core/models';
import { LaboratoryService } from '../../../core/services/laboratory.service';

@Component({
  selector: 'app-lab-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatProgressSpinner,
  ],
  templateUrl: './lab-form-dialog.html',
})
export class LabFormDialog {
  readonly dialogRef = inject(MatDialogRef<LabFormDialog>);
  readonly existing = inject<Laboratory | null>(MAT_DIALOG_DATA);
  private readonly labService = inject(LaboratoryService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: [this.existing?.name ?? '', Validators.required],
    description: [this.existing?.description ?? '', Validators.required],
  });

  get isEdit(): boolean {
    return !!this.existing;
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const payload = this.form.getRawValue();
    const req$ = this.existing
      ? this.labService.update(this.existing.id, payload)
      : this.labService.create(payload);

    req$.subscribe({
      next: lab => this.dialogRef.close(lab),
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Falha na operação.');
        this.loading.set(false);
      },
    });
  }
}
