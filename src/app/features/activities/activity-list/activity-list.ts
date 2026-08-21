import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  ACTIVITY_EDIT_ROLES,
  ACTIVITY_STATUSES,
  DashboardActivityItem,
  LabRole,
  Laboratory,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { ActivityFormDialog } from '../activity-form-dialog/activity-form-dialog';

@Component({
  selector: 'app-activity-list',
  imports: [DatePipe, RouterLink, MatButton, MatIcon, MatProgressSpinner],
  templateUrl: './activity-list.html',
  styleUrl: './activity-list.scss',
})
export class ActivityList implements OnInit {
  protected readonly statuses = ACTIVITY_STATUSES;
  protected readonly selectedStatus = signal<string | null>(null);
  protected readonly activities = signal<DashboardActivityItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly allLabs = signal<Laboratory[]>([]);
  protected readonly labsLoading = signal(true);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly labService = inject(LaboratoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly authService = inject(AuthService);

  /**
   * Quem pode criar: super admin, professor, ou qualquer lab_membership
   * cujos roles intersectem ACTIVITY_EDIT_ROLES.
   */
  protected readonly canCreate = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      (m.roles ?? []).some(r => ACTIVITY_EDIT_ROLES.includes(r as LabRole)),
    );
  });

  /** Labs em que o usuário pode criar atividades (select do dialog). */
  protected readonly createableLabs = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    if (user.is_super_admin || user.is_professor) return this.allLabs();
    const managed = new Set(
      (user.lab_memberships ?? [])
        .filter(m => (m.roles ?? []).some(r => ACTIVITY_EDIT_ROLES.includes(r as LabRole)))
        .map(m => m.lab_id),
    );
    return this.allLabs().filter(l => managed.has(l.id));
  });

  ngOnInit(): void {
    const param = this.route.snapshot.queryParamMap.get('status');
    this.selectedStatus.set(param && ACTIVITY_STATUSES.includes(param) ? param : null);
    this.load();
    this.labService.getAll().subscribe({
      next: labs => {
        this.allLabs.set(labs);
        this.labsLoading.set(false);
      },
      error: () => this.labsLoading.set(false),
    });
  }

  protected selectStatus(status: string | null): void {
    this.selectedStatus.set(status);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: status ? { status } : {},
      replaceUrl: true,
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.dashboardService.getActivities(this.selectedStatus() ?? undefined).subscribe({
      next: items => {
        this.activities.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load activities.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected openCreate(): void {
    const labs = this.createableLabs();
    // Com apenas 1 lab com permissão, pré-selecioná-lo.
    const labId = labs.length === 1 ? labs[0].id : null;
    const ref = this.dialog.open(ActivityFormDialog, {
      width: '640px',
      data: { labId, activity: null, labs },
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.snackBar.open('Atividade criada.', 'Dismiss', { duration: 3000 });
        this.load();
      }
    });
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  protected activityLink(a: DashboardActivityItem): (string | number)[] {
    return ['/labs', a.lab_id, 'activities', a.id];
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
    if (days < 0) return `${Math.abs(days)}d late`;
    if (days === 0) return 'Due today';
    return `${days}d left`;
  }
}
