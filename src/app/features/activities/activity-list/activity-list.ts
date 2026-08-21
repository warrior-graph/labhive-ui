import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DashboardActivityItem } from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';

const ACTIVITY_STATUSES = [
  'planned',
  'in_progress',
  'on_hold',
  'under_review',
  'accepted',
  'rejected',
  'completed',
  'cancelled',
];

@Component({
  selector: 'app-activity-list',
  imports: [DatePipe, RouterLink, MatIcon, MatProgressSpinner],
  templateUrl: './activity-list.html',
  styleUrl: './activity-list.scss',
})
export class ActivityList implements OnInit {
  protected readonly statuses = ACTIVITY_STATUSES;
  protected readonly selectedStatus = signal<string | null>(null);
  protected readonly activities = signal<DashboardActivityItem[]>([]);
  protected readonly loading = signal(true);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    const param = this.route.snapshot.queryParamMap.get('status');
    this.selectedStatus.set(param && ACTIVITY_STATUSES.includes(param) ? param : null);
    this.load();
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
