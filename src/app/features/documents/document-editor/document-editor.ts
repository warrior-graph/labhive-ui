import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness.js';

import { AuthService } from '../../../core/auth/auth.service';
import { CompileError, CompileJob, DocumentFileNode, LabDocument, PeerPresence } from '../../../core/models';
import { CollabService } from '../../../core/services/collab.service';
import { DocumentService } from '../../../core/services/document.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { CompileLogPanel } from './compile-log-panel';
import { FileTree } from './file-tree/file-tree';
import { LatexEditor } from './latex-editor';
import { PdfPreview } from './pdf-preview';
import { ShareDialog } from './share-dialog';

@Component({
  selector: 'app-document-editor',
  imports: [
    RouterLink,
    MatIcon,
    MatButton,
    MatIconButton,
    MatTooltip,
    MatMenu,
    MatMenuTrigger,
    MatMenuItem,
    MatProgressSpinner,
    FileTree,
    LatexEditor,
    PdfPreview,
    CompileLogPanel,
  ],
  templateUrl: './document-editor.html',
  styleUrl: './document-editor.scss',
})
export class DocumentEditor implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly documentService = inject(DocumentService);
  private readonly collab = inject(CollabService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly labId = signal(0);
  protected readonly docId = signal(0);
  protected readonly document = signal<LabDocument | null>(null);
  protected readonly files = signal<DocumentFileNode[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedFileId = signal<number | null>(null);
  protected readonly currentOpenFile = signal<DocumentFileNode | null>(null);
  protected readonly canEdit = computed(() => this.document()?.my_role !== 'viewer');

  protected readonly connectionStatus = this.collab.status;
  protected readonly peers = this.collab.peers;
  protected readonly pdfUrl = signal<string | null>(null);
  protected readonly compileJob = signal<CompileJob | null>(null);
  protected readonly compileLog = signal<string>('');
  protected readonly compileErrors = signal<CompileError[]>([]);
  protected readonly compiling = computed(() =>
    ['queued', 'running'].includes(this.compileJob()?.status ?? ''),
  );
  protected readonly goToLine = signal<number | null>(null);
  protected readonly sidebarCollapsed = signal(false);

  private readonly destroy$ = new Subject<void>();
  private pollSub: number | null = null;

  // Yjs bindings
  ytext = signal<Y.Text | null>(null);
  awareness = signal<Awareness | null>(null);

  constructor() {
    effect(() => {
      const fileId = this.selectedFileId();
      if (fileId) {
        this.openFile(fileId);
      }
    });

    this.collab.structuralEvents.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event.type === 'tree-changed' || event.type === 'file-deleted') {
        this.loadFiles();
      }
      if (event.type === 'doc-deleted') {
        this.snackBar.open('Documento excluído', 'Fechar', { duration: 4_000 });
        this.router.navigate(['/labs', this.labId(), 'documents']);
      }
    });
  }

  ngOnInit(): void {
    this.labId.set(Number(this.route.snapshot.paramMap.get('labId')));
    this.docId.set(Number(this.route.snapshot.paramMap.get('docId')));
    this.loadDocument();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
    this.collab.closeAll();
  }

  private loadDocument(): void {
    this.loading.set(true);
    this.documentService.get(this.labId(), this.docId()).subscribe({
      next: (doc) => {
        this.document.set(doc);
        this.collab.connectStructural(this.docId());
        this.loadFiles(() => {
          const mainId = doc.main_file_id ?? this.files().find((f) => f.name.endsWith('.tex'))?.id;
          if (mainId) {
            this.selectedFileId.set(mainId);
          }
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Erro ao carregar documento', 'Fechar', { duration: 5_000 });
      },
    });
  }

  private loadFiles(after?: () => void): void {
    this.documentService.getFiles(this.labId(), this.docId()).subscribe({
      next: (list) => {
        this.files.set(list);
        after?.();
      },
      error: () => this.snackBar.open('Erro ao carregar arquivos', 'Fechar', { duration: 5_000 }),
    });
  }

  private openFile(fileId: number): void {
    const file = this.files().find((f) => f.id === fileId);
    if (!file) return;
    this.currentOpenFile.set(file);
    this.collab.updateAwarenessFile(fileId);

    if (file.is_binary) {
      this.ytext.set(null);
      this.awareness.set(null);
      this.collab.closeFile();
      return;
    }

    this.documentService.getFileContent(this.labId(), this.docId(), fileId).subscribe({
      next: (resp) => {
        const handle = this.collab.openFile(this.docId(), fileId, resp.text_content);
        this.ytext.set(handle.ytext);
        this.awareness.set(handle.awareness);
      },
      error: () => {
        this.snackBar.open('Erro ao abrir arquivo', 'Fechar', { duration: 5_000 });
      },
    });
  }

  protected onSelectFile(fileId: number): void {
    const file = this.files().find((f) => f.id === fileId);
    if (file?.is_binary) {
      window.open(this.documentService.downloadFileUrl(this.labId(), this.docId(), fileId), '_blank');
      return;
    }
    this.selectedFileId.set(fileId);
  }

  protected createFile(parentId: number | null, name: string): void {
    this.documentService
      .createFile(this.labId(), this.docId(), { parent_id: parentId, name, kind: 'file' })
      .subscribe({
        next: () => this.loadFiles(),
        error: (err) => this.snackBar.open(err?.error?.error ?? 'Erro ao criar arquivo', 'Fechar', { duration: 5_000 }),
      });
  }

  protected createFolder(parentId: number | null, name: string): void {
    this.documentService
      .createFile(this.labId(), this.docId(), { parent_id: parentId, name, kind: 'folder' })
      .subscribe({
        next: () => this.loadFiles(),
        error: (err) => this.snackBar.open(err?.error?.error ?? 'Erro ao criar pasta', 'Fechar', { duration: 5_000 }),
      });
  }

  protected renameFile(fileId: number, name: string): void {
    this.documentService.updateFile(this.labId(), this.docId(), fileId, { name }).subscribe({
      next: () => this.loadFiles(),
      error: (err) => this.snackBar.open(err?.error?.error ?? 'Erro ao renomear', 'Fechar', { duration: 5_000 }),
    });
  }

  protected deleteFile(fileId: number): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Excluir arquivo',
        message: 'Tem certeza? Esta ação não pode ser desfeita.',
        confirmLabel: 'Excluir',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.documentService.deleteFile(this.labId(), this.docId(), fileId).subscribe({
        next: () => this.loadFiles(),
        error: () => this.snackBar.open('Erro ao excluir arquivo', 'Fechar', { duration: 5_000 }),
      });
    });
  }

  protected onUpload(parentId: number | null): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      this.documentService.uploadFile(this.labId(), this.docId(), parentId, file).subscribe({
        next: () => this.loadFiles(),
        error: (err) => this.snackBar.open(err?.error?.error ?? 'Erro no upload', 'Fechar', { duration: 5_000 }),
      });
    };
    input.click();
  }

  protected saveCurrentFile(): void {
    const file = this.currentOpenFile();
    const fileId = this.selectedFileId();
    if (!file || file.is_binary || fileId === null) return;
    const content = this.collab.getCurrentText();
    if (content === null) return;
    this.documentService.saveFileContent(this.labId(), this.docId(), fileId, content).subscribe({
      next: () => this.snackBar.open('Arquivo salvo', 'Fechar', { duration: 2_000 }),
      error: () => this.snackBar.open('Erro ao salvar arquivo', 'Fechar', { duration: 5_000 }),
    });
  }

  protected compile(): void {
    const fileId = this.selectedFileId();
    if (fileId !== null && this.currentOpenFile()?.is_binary === false) {
      const content = this.collab.getCurrentText();
      if (content !== null) {
        this.documentService.saveFileContent(this.labId(), this.docId(), fileId, content).subscribe({
          next: () => this.runCompile(),
          error: () => this.snackBar.open('Erro ao salvar antes de compilar', 'Fechar', { duration: 5_000 }),
        });
        return;
      }
    }
    this.runCompile();
  }

  private runCompile(): void {
    this.documentService.compile(this.labId(), this.docId()).subscribe({
      next: (job) => {
        this.compileJob.set(job);
        this.startPolling(job.id);
      },
      error: () => this.snackBar.open('Erro ao iniciar compilação', 'Fechar', { duration: 5_000 }),
    });
  }

  private startPolling(jobId: number): void {
    this.stopPolling();
    this.pollSub = window.setInterval(() => {
      this.documentService.getCompileJob(this.labId(), this.docId(), jobId).subscribe({
        next: (job) => {
          this.compileJob.set(job);
          if (job.status === 'success') {
            this.compileLog.set(job.log || 'Compilação concluída com sucesso.');
            this.compileErrors.set([]);
            if (job.has_pdf) {
              this.pdfUrl.set(this.documentService.pdfUrl(this.labId(), this.docId()));
            } else {
              this.compileLog.update((l) => `${l}\nAviso: sucesso reportado, mas nenhum PDF foi gerado.`);
            }
            this.stopPolling();
          } else if (job.status === 'error' || job.status === 'timeout') {
            this.compileLog.set(job.log || 'Erro na compilação.');
            this.compileErrors.set(job.errors_json ?? []);
            this.stopPolling();
          }
        },
        error: () => this.stopPolling(),
      });
    }, 1_500);
  }

  private stopPolling(): void {
    if (this.pollSub) {
      clearInterval(this.pollSub);
      this.pollSub = null;
    }
  }

  protected onErrorClick(err: CompileError): void {
    const file = this.files().find((f) => err.file.endsWith(f.name));
    if (file) {
      this.selectedFileId.set(file.id);
      this.goToLine.set(err.line);
      setTimeout(() => this.goToLine.set(null), 200);
    }
  }

  protected openShare(): void {
    this.dialog.open(ShareDialog, {
      width: '560px',
      data: { labId: this.labId(), docId: this.docId() },
    });
  }

  protected downloadTex(): void {
    const file = this.currentOpenFile();
    if (!file) return;
    const url = this.documentService.downloadFileUrl(this.labId(), this.docId(), file.id);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => this.triggerDownload(blob, file.name),
      error: () => this.snackBar.open('Erro ao baixar arquivo', 'Fechar', { duration: 5_000 }),
    });
  }

  protected downloadPdf(): void {
    const url = this.documentService.pdfUrl(this.labId(), this.docId());
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => this.triggerDownload(blob, 'document.pdf'),
      error: () => this.snackBar.open('Erro ao baixar PDF', 'Fechar', { duration: 5_000 }),
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  protected peerInitials(peer: PeerPresence): string {
    return peer.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected statusColor(): string {
    switch (this.connectionStatus()) {
      case 'connected':
        return '#22c55e';
      case 'connecting':
        return '#f59e0b';
      default:
        return '#ef4444';
    }
  }
}
