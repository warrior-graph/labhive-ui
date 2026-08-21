import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import {
  Announcement,
  LabRole,
  Laboratory,
  MANAGER_ROLES,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { AnnouncementsService } from '../../../core/services/announcements.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { extractApiError } from '../../../core/utils/api-error';
import { AnnouncementFormDialog } from './announcement-form-dialog';

@Component({
  selector: 'app-announcement-list',
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
  ],
  templateUrl: './announcement-list.html',
  styleUrl: './announcement-list.scss',
})
export class AnnouncementList implements OnInit {
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly allLabs = signal<Laboratory[]>([]);
  protected readonly loading = signal(true);
  protected readonly labsLoading = signal(true);
  protected readonly deleting = signal<Set<number>>(new Set());

  protected readonly authService = inject(AuthService);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly labService = inject(LaboratoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly pinned = computed(() =>
    this.announcements().filter(a => a.is_pinned),
  );
  protected readonly recent = computed(() =>
    this.announcements().filter(a => !a.is_pinned),
  );

  /**
   * Gestor pode criar/editar/excluir avisos: super admin, professor ou
   * qualquer membership com papel em MANAGER_ROLES (padrão canReview).
   */
  protected readonly canManage = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      m.roles.some(r => MANAGER_ROLES.includes(r as LabRole)),
    );
  });

  /** Labs em que o usuário pode criar avisos (select do dialog). */
  protected readonly manageableLabs = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    if (user.is_super_admin || user.is_professor) return this.allLabs();
    const managed = new Set(
      (user.lab_memberships ?? [])
        .filter(m => m.roles.some(r => MANAGER_ROLES.includes(r as LabRole)))
        .map(m => m.lab_id),
    );
    return this.allLabs().filter(l => managed.has(l.id));
  });

  ngOnInit(): void {
    this.load();
    this.labService.getAll().subscribe({
      next: labs => {
        this.allLabs.set(labs);
        this.labsLoading.set(false);
      },
      error: () => this.labsLoading.set(false),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.announcementsService.getAnnouncements().subscribe({
      next: list => {
        this.announcements.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Falha ao carregar avisos.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected openCreate(): void {
    const ref = this.dialog.open(AnnouncementFormDialog, {
      width: '560px',
      data: { labs: this.manageableLabs(), announcement: null },
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.snackBar.open('Aviso criado.', 'Dismiss', { duration: 3000 });
        this.load();
      }
    });
  }

  protected openEdit(a: Announcement): void {
    const ref = this.dialog.open(AnnouncementFormDialog, {
      width: '560px',
      data: { labs: this.manageableLabs(), announcement: a },
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.snackBar.open('Aviso atualizado.', 'Dismiss', { duration: 3000 });
        this.load();
      }
    });
  }

  protected remove(a: Announcement): void {
    if (!confirm('Excluir o aviso "' + a.title + '"?')) return;
    this.deleting.update(s => { const n = new Set(s); n.add(a.id); return n; });
    this.announcementsService.deleteAnnouncement(a.id).subscribe({
      next: () => {
        this.announcements.update(list => list.filter(x => x.id !== a.id));
        this.deleting.update(s => { const n = new Set(s); n.delete(a.id); return n; });
        this.snackBar.open('Aviso excluído.', 'Dismiss', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.update(s => { const n = new Set(s); n.delete(a.id); return n; });
        this.snackBar.open(extractApiError(err, 'Falha ao excluir aviso.'), 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  /** Gestores (canManage) ou o próprio autor podem editar/excluir. */
  protected canEdit(a: Announcement): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (this.canManage()) return true;
    return a.author_id !== null && a.author_id === user.id;
  }
}
