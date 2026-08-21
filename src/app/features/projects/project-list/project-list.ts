import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DashboardProjectItem } from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';

const PROJECT_STATUSES = ['planned', 'active', 'completed', 'cancelled'];

@Component({
  selector: 'app-project-list',
  imports: [DatePipe, RouterLink, MatIcon, MatProgressSpinner],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList implements OnInit {
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly selectedStatus = signal<string | null>(null);
  protected readonly projects = signal<DashboardProjectItem[]>([]);
  protected readonly loading = signal(true);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    const param = this.route.snapshot.queryParamMap.get('status');
    this.selectedStatus.set(param && PROJECT_STATUSES.includes(param) ? param : null);
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
    this.dashboardService.getProjects(this.selectedStatus() ?? undefined).subscribe({
      next: items => {
        this.projects.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load projects.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  protected projectLink(p: DashboardProjectItem): (string | number)[] {
    return ['/labs', p.lab_id, 'projects', p.id];
  }
}
