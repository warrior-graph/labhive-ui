import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

export interface NameEditDialogData {
  title: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-name-edit-dialog',
  imports: [ReactiveFormsModule, MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatLabel, MatInput],
  templateUrl: './name-edit-dialog.html',
})
export class NameEditDialog {
  readonly data = inject<NameEditDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<NameEditDialog>);
  readonly name = new FormControl(this.data.value, { nonNullable: true, validators: [Validators.required, Validators.maxLength(128)] });

  save(): void {
    const value = this.name.value.trim();
    if (this.name.invalid || !value) return;
    this.dialogRef.close(value);
  }
}
