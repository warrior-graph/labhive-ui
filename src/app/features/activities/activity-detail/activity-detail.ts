import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ActivityDetail as ActivityDetailModel, LabRole, MANAGER_ROLES } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-activity-detail',
  imports: [DatePipe, RouterLink, MatButton, MatDivider, MatIcon, MatProgressSpinner],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.scss',
})
export class ActivityDetail implements OnInit {
  protected readonly activity = signal<ActivityDetailModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly reviewing = signal<'accepted' | 'rejected' | null>(null);

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
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
        this.snackBar.open('Activity not found', 'Dismiss', { duration: 3000 });
        this.router.navigate(['/labs', this.labId]);
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
        let msg = 'Failed to review activity.';
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
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  protected personName(p: { first_name: string; last_name: string }): string {
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  }
}