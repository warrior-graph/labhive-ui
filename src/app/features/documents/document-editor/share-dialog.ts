import { Component, OnInit, inject, signal } from '@angular/core';
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
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DocumentMemberEntry, DocumentRole, LabMembership, Member } from '../../../core/models';
import { DocumentService } from '../../../core/services/document.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';

export interface ShareDialogData {
  labId: number;
  docId: number;
}

@Component({
  selector: 'app-share-dialog',
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatButton,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './share-dialog.html',
})
export class ShareDialog implements OnInit {
  private readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);
  private readonly documentService = inject(DocumentService);
  private readonly laboratoryService = inject(LaboratoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<ShareDialog>);

  protected readonly members = signal<DocumentMemberEntry[]>([]);
  protected readonly memberships = signal<LabMembership[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedMemberId = signal<number | null>(null);
  protected readonly selectedRole = signal<Exclude<DocumentRole, 'owner'>>('editor');

  ngOnInit(): void {
    this.loadMembers();
    this.loadLabMembers();
  }

  private loadMembers(): void {
    this.documentService.listMembers(this.data.labId, this.data.docId).subscribe({
      next: (list) => this.members.set(list),
      error: () => this.snackBar.open('Erro ao carregar membros', 'Fechar', { duration: 5_000 }),
    });
  }

  private loadLabMembers(): void {
    this.laboratoryService.getMembers(this.data.labId).subscribe({
      next: (list) => {
        this.memberships.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Erro ao carregar laboratório', 'Fechar', { duration: 5_000 });
      },
    });
  }

  protected availableMembers(): Member[] {
    const sharedIds = new Set(this.members().map((m) => m.member_id));
    return this.memberships()
      .map((m) => m.member)
      .filter((m): m is Member => !!m && !sharedIds.has(m.id));
  }

  protected addMember(): void {
    const memberId = this.selectedMemberId();
    if (memberId === null) return;
    this.documentService
      .addMember(this.data.labId, this.data.docId, memberId, this.selectedRole())
      .subscribe({
        next: (entry) => {
          this.members.update((list) => [...list, entry]);
          this.selectedMemberId.set(null);
        },
        error: (err) => {
          const msg = err?.error?.error ?? 'Erro ao compartilhar';
          this.snackBar.open(msg, 'Fechar', { duration: 5_000 });
        },
      });
  }

  protected changeRole(memberId: number, role: Exclude<DocumentRole, 'owner'>): void {
    this.documentService
      .updateMemberRole(this.data.labId, this.data.docId, memberId, role)
      .subscribe({
        next: (entry) => {
          this.members.update((list) =>
            list.map((m) => (m.member_id === entry.member_id ? entry : m)),
          );
        },
        error: () => this.snackBar.open('Erro ao alterar papel', 'Fechar', { duration: 5_000 }),
      });
  }

  protected removeMember(memberId: number): void {
    this.documentService.removeMember(this.data.labId, this.data.docId, memberId).subscribe({
      next: () => {
        this.members.update((list) => list.filter((m) => m.member_id !== memberId));
      },
      error: () => this.snackBar.open('Erro ao remover membro', 'Fechar', { duration: 5_000 }),
    });
  }

  protected roleLabel(role: string): string {
    return { owner: 'Proprietário', editor: 'Editor', viewer: 'Visualizador' }[role] ?? role;
  }
}
