import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import { InviteResponse } from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { extractApiError } from '../../../core/utils/api-error';

export interface InviteDialogData {
  labId: number;
  labName: string;
}

@Component({
  selector: 'app-invite-dialog',
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatIcon,
    MatOption,
    MatProgressSpinner,
    MatSelect,
    MatTooltip,
  ],
  template: `
    <h2 mat-dialog-title>Generate Invite Link</h2>
    <mat-dialog-content>
      <p class="invite-intro">
        Anyone with this link can register and will be auto-approved as a
        <strong>Research Fellow</strong> in
        <strong>{{ data.labName }}</strong>.
      </p>

      @if (!invite()) {
        <form class="invite-form" (ngSubmit)="generate()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Validity</mat-label>
            <mat-select [value]="days" (valueChange)="days = $event">
              <mat-option [value]="1">1 day</mat-option>
              <mat-option [value]="7">7 days</mat-option>
              <mat-option [value]="30">30 days</mat-option>
            </mat-select>
          </mat-form-field>

          @if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }
        </form>
      } @else {
        <div class="invite-result">
          <p class="expiry-label">
            Expires on {{ invite()!.expires_at | date: 'medium' }}
          </p>
          <div class="invite-url-row">
            <input
              class="invite-url"
              [value]="invite()!.url"
              readonly
              (focus)="selectUrl($event)"
            />
            <button
              mat-icon-button
              color="primary"
              matTooltip="Copy link"
              aria-label="Copy invite link"
              (click)="copy()"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <p class="copy-hint">Share this link with the person you want to invite.</p>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">
        @if (invite()) { Close } @else { Cancel }
      </button>
      @if (!invite()) {
        <button
          mat-raised-button
          color="primary"
          [disabled]="generating()"
          (click)="generate()"
        >
          @if (generating()) {
            <mat-progress-spinner diameter="18" mode="indeterminate" />
          } @else {
            Generate Link
          }
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
    .invite-intro {
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .full-width { width: 100%; margin-bottom: 8px; }
    .error-msg { color: var(--mat-sys-error); font-size: 13px; margin: 0; }
    .invite-result { margin: 8px 0 4px; }
    .expiry-label {
      font-size: 13px;
      font-weight: 500;
      margin: 0 0 8px;
      color: var(--mat-sys-on-surface);
    }
    .invite-url-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .invite-url {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 6px;
      background: var(--mat-sys-surface-container);
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 12px;
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-hint {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin: 8px 0 0;
    }
    `,
  ],
})
export class InviteDialog {
  readonly dialogRef = inject(MatDialogRef<InviteDialog>);
  readonly data = inject<InviteDialogData>(MAT_DIALOG_DATA);
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly invite = signal<InviteResponse | null>(null);
  protected days = 7;

  protected generate(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.error.set(null);
    this.memberService.createInvite(this.data.labId, this.days).subscribe({
      next: invite => {
        this.invite.set(invite);
        this.generating.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extractApiError(err, 'Failed to generate invite link.'));
        this.generating.set(false);
      },
    });
  }

  protected selectUrl(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected async copy(): Promise<void> {
    const url = this.invite()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.snackBar.open('Invite link copied', 'Dismiss', { duration: 2000 });
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.snackBar.open('Invite link copied', 'Dismiss', { duration: 2000 });
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }
}
