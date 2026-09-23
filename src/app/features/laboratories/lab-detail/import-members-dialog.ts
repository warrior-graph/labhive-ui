import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ImportReport } from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { extractApiError } from '../../../core/utils/api-error';

export interface ImportMembersDialogData {
  labId: number;
  labName: string;
}

@Component({
  selector: 'app-import-members-dialog',
  imports: [
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    MatProgressSpinner,
  ],
  template: `
    <h2 mat-dialog-title>Importar membros (CSV)</h2>
    <mat-dialog-content>
      <p class="intro">
        O arquivo deve conter as colunas
        <strong>first_name, last_name, email, roles</strong>. Opcionais:
        <strong>cpf, compensation_type, reports_to_email</strong>. Separe múltiplos papéis
        com <strong>;</strong>.
      </p>

      @if (!report()) {
        <label class="file-picker">
          <input type="file" accept=".csv,text/csv" (change)="selectFile($event)" hidden />
          <mat-icon>upload_file</mat-icon>
          <span>{{ fileName() || 'Escolher arquivo CSV' }}</span>
        </label>
        @if (error()) {
          <p class="error-msg">{{ error() }}</p>
        }
      } @else if (report(); as r) {
        <div class="summary-grid">
          <div class="summary-item">
            <span class="label">Linhas</span><strong>{{ r.total_rows }}</strong>
          </div>
          <div class="summary-item ok">
            <span class="label">Válidas</span><strong>{{ r.valid }}</strong>
          </div>
          <div class="summary-item" [class.bad]="r.invalid > 0">
            <span class="label">Com erro</span><strong>{{ r.invalid }}</strong>
          </div>
        </div>

        @if (r.errors.length) {
          <h3 class="section-title">Linhas com erro</h3>
          <ul class="error-list">
            @for (row of r.errors.slice(0, 12); track row.line) {
              <li>
                <strong>Linha {{ row.line }}</strong>
                @if (row.email) { ({{ row.email }}) }:
                {{ row.errors.join(' ') }}
              </li>
            }
          </ul>
          @if (r.errors.length > 12) {
            <p class="more">e mais {{ r.errors.length - 12 }} linha(s) com erro.</p>
          }
        }

        @if (r.preview.length) {
          <h3 class="section-title">Serão importadas {{ r.preview.length }} linha(s)</h3>
          <ul class="preview-list">
            @for (row of r.preview.slice(0, 12); track row.line) {
              <li>
                <span>{{ row.name }} — {{ row.email }}</span>
                <small>
                  {{ row.roles.join(', ') }}
                  @if (row.existing_member) { · membro existente }
                  @if (row.reactivates) { · reativa vínculo }
                </small>
              </li>
            }
          </ul>
        }

        @if (!r.dry_run && r.temporary_credentials.length) {
          <h3 class="section-title">Credenciais temporárias</h3>
          <p class="warn">
            Copie agora: estas senhas são exibidas uma única vez.
          </p>
          <ul class="credential-list">
            @for (cred of r.temporary_credentials; track cred.email) {
              <li>
                <span>{{ cred.name }} — {{ cred.email }}</span>
                <code>{{ cred.temporary_password }}</code>
              </li>
            }
          </ul>
          <button mat-stroked-button type="button" (click)="copyCredentials()">
            <mat-icon>content_copy</mat-icon>Copiar credenciais
          </button>
        }

        @if (error()) {
          <p class="error-msg">{{ error() }}</p>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">
        {{ imported() ? 'Fechar' : 'Cancelar' }}
      </button>
      @if (report(); as r) {
        @if (r.dry_run) {
          <button
            mat-raised-button
            color="primary"
            [disabled]="importing() || r.valid === 0"
            (click)="confirmImport()"
          >
            @if (importing()) {
              <mat-progress-spinner diameter="18" mode="indeterminate" />
            } @else {
              Importar {{ r.valid }} linha(s)
            }
          </button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .intro {
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 16px;
        color: var(--mat-sys-on-surface-variant);
      }
      .file-picker {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px;
        border: 2px dashed var(--mat-sys-outline-variant);
        border-radius: 10px;
        cursor: pointer;
        font-weight: 500;
        &:hover { border-color: var(--mat-sys-primary); }
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .summary-item {
        padding: 10px;
        border-radius: 8px;
        background: var(--mat-sys-surface-container);
        .label { display: block; font-size: 12px; color: var(--mat-sys-on-surface-variant); }
        strong { font-size: 18px; }
        &.ok strong { color: var(--sem-success-fg); }
        &.bad strong { color: var(--sem-error-fg); }
      }
      .section-title {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
        margin: 16px 0 8px;
      }
      .error-list, .preview-list, .credential-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 200px;
        overflow-y: auto;
        li {
          padding: 6px 0;
          border-bottom: 1px solid var(--mat-sys-outline-variant);
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        small { color: var(--mat-sys-on-surface-variant); }
      }
      .error-list li { color: var(--sem-error-fg); }
      .credential-list code {
        font-family: var(--font-mono, ui-monospace, monospace);
        background: var(--mat-sys-surface-container-highest);
        padding: 2px 6px;
        border-radius: 4px;
        width: fit-content;
      }
      .warn { color: var(--sem-warning-fg); font-size: 13px; margin: 0 0 8px; }
      .more { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
      .error-msg { color: var(--mat-sys-error); font-size: 13px; margin: 8px 0 0; }
    `,
  ],
})
export class ImportMembersDialog {
  readonly dialogRef = inject(MatDialogRef<ImportMembersDialog>);
  readonly data = inject<ImportMembersDialogData>(MAT_DIALOG_DATA);
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly report = signal<ImportReport | null>(null);
  protected readonly fileName = signal<string>('');
  protected readonly error = signal<string | null>(null);
  protected readonly importing = signal(false);

  /** True once a real import completed (not just a preview). */
  protected readonly imported = computed(() => {
    const current = this.report();
    return !!current && !current.dry_run;
  });

  private selected: File | null = null;

  protected close(): void {
    this.dialogRef.close(this.imported());
  }

  protected selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selected = file;
    this.fileName.set(file.name);
    this.error.set(null);
    this.memberService.previewImport(this.data.labId, file).subscribe({
      next: report => this.report.set(report),
      error: (err: HttpErrorResponse) =>
        this.error.set(extractApiError(err, 'Não foi possível ler o arquivo CSV.')),
    });
  }

  protected confirmImport(): void {
    if (!this.selected || this.importing()) return;
    this.importing.set(true);
    this.error.set(null);
    this.memberService.importMembers(this.data.labId, this.selected).subscribe({
      next: report => {
        this.report.set(report);
        this.importing.set(false);
        this.snackBar.open(
          `${report.added_to_lab + report.reactivated} membro(s) importado(s).`,
          'Fechar',
          { duration: 4000 },
        );
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extractApiError(err, 'Não foi possível importar os membros.'));
        this.importing.set(false);
      },
    });
  }

  protected async copyCredentials(): Promise<void> {
    const credentials = this.report()?.temporary_credentials ?? [];
    const text = credentials
      .map(cred => `${cred.name}\t${cred.email}\t${cred.temporary_password}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open('Credenciais copiadas', 'Fechar', { duration: 2500 });
    } catch {
      this.snackBar.open('Não foi possível copiar automaticamente.', 'Fechar', { duration: 3000 });
    }
  }
}
