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
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { LabMembership } from '../../../core/models';
import { ResearchService } from '../../../core/services/research.service';

export interface ResearchFormData {
  labId: number;
  labMembers: LabMembership[];
}

@Component({
  selector: 'app-research-form-dialog',
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
    MatSelect,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './research-form-dialog.html',
})
export class ResearchFormDialog {
  readonly dialogRef = inject(MatDialogRef<ResearchFormDialog>);
  readonly data = inject<ResearchFormData>(MAT_DIALOG_DATA);
  private readonly researchService = inject(ResearchService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    manager_id: [null as number | null],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { name, description, manager_id } = this.form.getRawValue();
    this.researchService
      .create(this.data.labId, {
        name,
        ...(description && { description }),
        ...(manager_id != null && { manager_id }),
      })
      .subscribe({
        next: research => this.dialogRef.close(research),
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message ?? 'Falha ao criar grupo de pesquisa.');
          this.loading.set(false);
        },
      });
  }
}
