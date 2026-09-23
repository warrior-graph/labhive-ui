import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { LabDocument } from '../../../core/models';
import { DocumentService } from '../../../core/services/document.service';

export interface DocumentFormData {
  labId: number;
  document?: LabDocument;
}

@Component({
  selector: 'app-document-form-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  templateUrl: './document-form-dialog.html',
})
export class DocumentFormDialog {
  private readonly dialogRef = inject(MatDialogRef<DocumentFormDialog, LabDocument>);
  private readonly data = inject<DocumentFormData>(MAT_DIALOG_DATA);
  private readonly documentService = inject(DocumentService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isEdit = !!this.data.document;
  name = this.data.document?.name ?? '';
  template: 'blank' | 'article' = 'article';
  saving = false;

  save(): void {
    const name = this.name.trim();
    if (!name) return;
    this.saving = true;

    if (this.isEdit && this.data.document) {
      this.documentService.rename(this.data.labId, this.data.document.id, name).subscribe({
        next: (doc) => this.dialogRef.close(doc),
        error: () => {
          this.saving = false;
          this.snackBar.open('Erro ao renomear documento', 'Fechar', { duration: 5_000 });
        },
      });
    } else {
      this.documentService
        .create(this.data.labId, { name, template: this.template })
        .subscribe({
          next: (doc) => this.dialogRef.close(doc),
          error: () => {
            this.saving = false;
            this.snackBar.open('Erro ao criar documento', 'Fechar', { duration: 5_000 });
          },
        });
    }
  }
}
