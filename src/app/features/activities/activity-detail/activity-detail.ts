import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  ACTIVITY_DELETE_ROLES,
  ACTIVITY_EDIT_ROLES,
  ActivityDetail as ActivityDetailModel,
  LabRole,
  MANAGER_ROLES,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { extractApiError } from '../../../core/utils/api-error';
import { ActivityFormDialog } from '../activity-form-dialog/activity-form-dialog';

@Component({
  selector: 'app-activity-detail',
  imports: [DatePipe, RouterLink, MatButton, MatDivider, MatIcon, MatProgressSpinner],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.scss',
})
export class ActivityDetail implements OnInit {
  private static readonly STATUS_LABELS: Record<string, string> = {
    planned: 'Planejada',
    in_progress: 'Em andamento',
    on_hold: 'Em espera',
    under_review: 'Em revisão',
    accepted: 'Aceita',
    rejected: 'Rejeitada',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    active: 'Ativo',
  };

  protected readonly activity = signal<ActivityDetailModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly reviewing = signal<'accepted' | 'rejected' | null>(null);
  protected readonly removing = signal(false);

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labId = 0;
  protected activityId = 0;

  /**
   * Quem pode revisar: super admin, professor, ou qualquer lab_membership
   * cujos roles intersectem MANAGER_ROLES.
   */
  protected readonly canReview = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      (m.roles ?? []).some(r => MANAGER_ROLES.includes(r as LabRole)),
    );
  });

  /** Quem pode editar: mesmos papéis da criação (ACTIVITY_EDIT_ROLES). */
  protected readonly canEdit = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      (m.roles ?? []).some(r => ACTIVITY_EDIT_ROLES.includes(r as LabRole)),
    );
  });

  /** Quem pode excluir: super admin, professor ou ACTIVITY_DELETE_ROLES. */
  protected readonly canDelete = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      (m.roles ?? []).some(r => ACTIVITY_DELETE_ROLES.includes(r as LabRole)),
    );
  });

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
    this.activityId = Number(this.route.snapshot.paramMap.get('activityId'));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.dashboardService.getActivity(this.labId, this.activityId).subscribe({
      next: a => {
        this.activity.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Atividade não encontrada', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/labs', this.labId]);
      },
    });
  }

  protected openEdit(): void {
    const current = this.activity();
    if (!current) return;
    const ref = this.dialog.open(ActivityFormDialog, {
      width: '640px',
      data: { labId: current.lab_id, activity: current, labs: [] },
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.activity.set(updated);
        this.snackBar.open('Atividade atualizada.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  protected remove(): void {
    const current = this.activity();
    if (!current) return;
    if (!confirm(`Excluir a atividade "${current.title}"?`)) return;
    this.removing.set(true);
    this.dashboardService.deleteActivity(this.labId, this.activityId).subscribe({
      next: () => {
        this.removing.set(false);
        this.snackBar.open('Atividade excluída.', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/labs', this.labId]);
      },
      error: (err: HttpErrorResponse) => {
        this.removing.set(false);
        this.snackBar.open(extractApiError(err, 'Falha ao excluir atividade.'), 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  protected review(decision: 'accepted' | 'rejected'): void {
    this.reviewing.set(decision);
    this.dashboardService.reviewActivity(this.labId, this.activityId, decision).subscribe({
      next: updated => {
        this.activity.set(updated);
        this.reviewing.set(null);
        this.snackBar.open(
          decision === 'accepted' ? 'Atividade aceita.' : 'Atividade rejeitada.',
          'Dismiss',
          { duration: 3000 },
        );
      },
      error: err => {
        this.reviewing.set(null);
        let msg = 'Falha ao revisar a atividade.';
        if (err?.status === 409) {
          msg = 'Atividade não está mais em revisão';
        } else if (err?.status === 403) {
          msg = 'Sem permissão';
        } else {
          msg = extractApiError(err, msg);
        }
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected statusLabel(status: string): string {
    return (
      ActivityDetail.STATUS_LABELS[status] ??
      status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    );
  }

  protected daysLeft(deadline: string | null): number | null {
    if (!deadline) return null;
    const end = new Date(deadline).getTime();
    if (Number.isNaN(end)) return null;
    return Math.ceil((end - Date.now()) / 86_400_000);
  }

  protected deadlineClass(deadline: string | null): string {
    const days = this.daysLeft(deadline);
    if (days === null || days > 7) return 'deadline-future';
    if (days < 0) return 'deadline-overdue';
    return 'deadline-soon';
  }

  protected deadlineLabel(deadline: string | null): string {
    const days = this.daysLeft(deadline);
    if (days === null) return '—';
    if (days < 0) return `${Math.abs(days)}d em atraso`;
    if (days === 0) return 'Vence hoje';
    return `${days}d restantes`;
  }

  protected personName(p: { first_name: string; last_name: string }): string {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  }
}
