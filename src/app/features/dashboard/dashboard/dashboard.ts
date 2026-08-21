import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../../core/auth/auth.service';
import {
  DashboardDeadline,
  DashboardPendingMember,
  DashboardSummary,
} from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';
import { MemberService } from '../../../core/services/member.service';

interface StatCard {
  icon: string;
  label: string;
  value: number;
  link: (string | number)[];
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    RouterLink,
    MatButton,
    MatCard,
    MatCardContent,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly approving = signal<Set<number>>(new Set());

  protected readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly userName = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return '';
    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  });

  protected readonly statCards = computed<StatCard[]>(() => {
    const c = this.summary()?.counts;
    if (!c) return [];
    const cards: StatCard[] = [
      { icon: 'group', label: 'Membros ativos', value: c.active_members, link: ['/admin/pending'], queryParams: { tab: 'all' } },
      { icon: 'pending_actions', label: 'Pendentes de aprovação', value: c.pending_members, link: ['/admin/pending'] },
      { icon: 'rocket_launch', label: 'Atividades em andamento', value: c.activities_in_progress, link: ['/activities'], queryParams: { status: 'in_progress' } },
      { icon: 'rate_review', label: 'Em revisão', value: c.activities_under_review, link: ['/activities'], queryParams: { status: 'under_review' } },
      { icon: 'task_alt', label: 'Concluídas', value: c.activities_completed, link: ['/activities'], queryParams: { status: 'completed' } },
      { icon: 'workspaces', label: 'Projetos ativos', value: c.projects_active, link: ['/projects'], queryParams: { status: 'active' } },
      { icon: 'inventory_2', label: 'Itens de inventário', value: c.inventory_items, link: ['/inventory'] },
    ];
    return cards;
  });

  /**
   * Prazos na janela de hoje (days_left === 0) ou esta semana (1..7).
   * Gestor vê upcoming_deadlines; membro vê my_deadlines.
   */
  protected readonly deadlineStrip = computed<DashboardDeadline[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const list = s.is_manager ? s.upcoming_deadlines : s.my_deadlines;
    return list.filter(
      d => d.days_left !== null && d.days_left >= 0 && d.days_left <= 7,
    );
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.dashboardService.getSummary().subscribe({
      next: summary => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load dashboard.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected approveMember(m: DashboardPendingMember): void {
    this.setApproving(m.member_id, true);
    this.memberService.approveMember(m.member_id).subscribe({
      next: () => {
        this.summary.update(s =>
          s
            ? {
                ...s,
                pending_members: s.pending_members.filter(p => p.member_id !== m.member_id),
                counts: {
                  ...s.counts,
                  pending_members: Math.max(0, s.counts.pending_members - 1),
                },
              }
            : s,
        );
        this.setApproving(m.member_id, false);
        this.snackBar.open(
          `${m.first_name} ${m.last_name} approved.`,
          'Dismiss',
          { duration: 4000 },
        );
      },
      error: () => {
        this.setApproving(m.member_id, false);
        this.snackBar.open('Failed to approve member.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  private setApproving(id: number, on: boolean): void {
    this.approving.update(s => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  protected statusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  protected deadlineClass(d: DashboardDeadline): string {
    if (d.overdue) return 'deadline-overdue';
    if (d.days_left !== null && d.days_left <= 7) return 'deadline-soon';
    return 'deadline-future';
  }

  protected deadlineLabel(d: DashboardDeadline): string {
    if (d.days_left === null) return '—';
    if (d.overdue) return `${Math.abs(d.days_left)}d late`;
    if (d.days_left === 0) return 'Due today';
    return `${d.days_left}d left`;
  }

  protected deadlineLink(d: DashboardDeadline): (string | number)[] {
    if (d.type === 'project') {
      return ['/labs', d.lab_id, 'projects', d.id];
    }
    return ['/labs', d.lab_id, 'activities', d.id];
  }

  protected activityLink(a: { lab_id: number; id: number }): (string | number)[] {
    return ['/labs', a.lab_id, 'activities', a.id];
  }

  protected projectLink(p: { lab_id: number; id: number }): (string | number)[] {
    return ['/labs', p.lab_id, 'projects', p.id];
  }
}
