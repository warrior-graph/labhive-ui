import { Component, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';

import { DocumentFileNode } from '../../../../core/models';

@Component({
  selector: 'app-file-tree',
  imports: [
    NgTemplateOutlet,
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatMenu,
    MatMenuTrigger,
    MatMenuItem,
  ],
  templateUrl: './file-tree.html',
  styleUrl: './file-tree.scss',
})
export class FileTree {
  readonly files = input.required<DocumentFileNode[]>();
  readonly selectedFileId = input<number | null>(null);
  readonly canEdit = input(false);

  readonly selectFile = output<number>();
  readonly createFile = output<{ parentId: number | null; name: string }>();
  readonly createFolder = output<{ parentId: number | null; name: string }>();
  readonly uploadFile = output<{ parentId: number | null }>();
  readonly deleteFile = output<number>();
  readonly renameFile = output<{ fileId: number; name: string }>();

  protected readonly expanded = signal<Set<number>>(new Set());

  protected readonly rootNodes = computed(() =>
    this.files().filter((f) => f.parent_id === null).sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected toggleExpand(node: DocumentFileNode, event: Event): void {
    event.stopPropagation();
    if (node.kind !== 'folder') return;
    this.expanded.update((set) => {
      const copy = new Set(set);
      if (copy.has(node.id)) copy.delete(node.id);
      else copy.add(node.id);
      return copy;
    });
  }

  protected childrenOf(parentId: number): DocumentFileNode[] {
    return this.files()
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  protected promptCreate(parentId: number | null, kind: 'file' | 'folder'): void {
    const label = kind === 'folder' ? 'pasta' : 'arquivo';
    const name = window.prompt(`Nome da ${label}:`);
    if (!name?.trim()) return;
    if (kind === 'file') {
      this.createFile.emit({ parentId, name: name.trim() });
    } else {
      this.createFolder.emit({ parentId, name: name.trim() });
    }
  }

  protected promptRename(file: DocumentFileNode): void {
    const name = window.prompt('Novo nome:', file.name);
    if (!name?.trim() || name.trim() === file.name) return;
    this.renameFile.emit({ fileId: file.id, name: name.trim() });
  }

  protected onUpload(parentId: number | null): void {
    this.uploadFile.emit({ parentId });
  }
}
