import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import { AuthService } from '../../../core/auth/auth.service';
import { LabDocument } from '../../../core/models';
import { DocumentService } from '../../../core/services/document.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { DocumentFormDialog } from './document-form-dialog';

@Component({
  selector: 'app-document-list',
  imports: [
    DatePipe,
    RouterLink,
    MatIcon,
    MatProgressSpinner,
    MatButton,
    MatIconButton,
    MatTooltip,
  ],
  templateUrl: './document-list.html',
  styleUrl: './document-list.scss',
})
export class DocumentList implements OnInit {
  protected readonly documents = signal<LabDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly deleting = signal<Set<number>>(new Set());

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentService = inject(DocumentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly labId = computed(() => Number(this.route.snapshot.paramMap.get('labId')));
  protected readonly activeLabId = this.authService.activeLabId;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    const labId = this.labId();
    this.loading.set(true);
    this.documentService.list(labId).subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Erro ao carregar documentos', 'Fechar', { duration: 5_000 });
      },
    });
  }

  protected docLink(doc: LabDocument): string[] {
    return ['/labs', String(this.labId()), 'documents', String(doc.id)];
  }

  protected openCreate(): void {
    const ref = this.dialog.open(DocumentFormDialog, {
      width: '480px',
      data: { labId: this.labId() },
    });
    ref.afterClosed().subscribe((result: LabDocument | undefined) => {
      if (result) {
        this.router.navigate(this.docLink(result));
      }
    });
  }

  protected openRename(doc: LabDocument): void {
    const ref = this.dialog.open(DocumentFormDialog, {
      width: '480px',
      data: { labId: this.labId(), document: doc },
    });
    ref.afterClosed().subscribe((result: LabDocument | undefined) => {
      if (result) {
        this.documents.update((list) =>
          list.map((d) => (d.id === result.id ? { ...d, name: result.name } : d)),
        );
      }
    });
  }

  protected deleteDocument(doc: LabDocument): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Excluir documento',
        message: `Tem certeza que deseja excluir "${doc.name}"? Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.deleting.update((set) => new Set(set).add(doc.id));
      this.documentService.remove(this.labId(), doc.id).subscribe({
        next: () => {
          this.deleting.update((set) => {
            const copy = new Set(set);
            copy.delete(doc.id);
            return copy;
          });
          this.documents.update((list) => list.filter((d) => d.id !== doc.id));
          this.snackBar.open('Documento excluído', 'Fechar', { duration: 3_000 });
        },
        error: () => {
          this.deleting.update((set) => {
            const copy = new Set(set);
            copy.delete(doc.id);
            return copy;
          });
          this.snackBar.open('Erro ao excluir documento', 'Fechar', { duration: 5_000 });
        },
      });
    });
  }

  protected roleLabel(role: string): string {
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      editor: 'Editor',
      viewer: 'Visualizador',
    };
    return labels[role] ?? role;
  }
}
