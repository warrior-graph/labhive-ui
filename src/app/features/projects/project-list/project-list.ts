import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import {
  DashboardProjectItem,
  LabRole,
  Laboratory,
  MANAGER_ROLES,
  TECH_LEAD_AND_ABOVE,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { MemberService } from '../../../core/services/member.service';
import { ProjectService } from '../../../core/services/project.service';
import { ResearchService } from '../../../core/services/research.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ProjectFormDialog } from '../../laboratories/lab-detail/project-form-dialog';

const PROJECT_STATUSES = ['planned', 'active', 'completed', 'cancelled'];

@Component({
  selector: 'app-project-list',
  imports: [
    DatePipe,
    RouterLink,
    MatIcon,
    MatProgressSpinner,
    MatButton,
    MatIconButton,
    MatTooltip,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList implements OnInit {
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly selectedStatus = signal<string | null>(null);
  protected readonly projects = signal<DashboardProjectItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly allLabs = signal<Laboratory[]>([]);
  protected readonly labsLoading = signal(true);
  protected readonly deleting = signal<Set<number>>(new Set());

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dashboardService = inject(DashboardService);
  private readonly projectService = inject(ProjectService);
  private readonly researchService = inject(ResearchService);
  private readonly memberService = inject(MemberService);
  private readonly labService = inject(LaboratoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Criar/editar projetos: super admin, professor ou papel em TECH_LEAD_AND_ABOVE. */
  protected readonly canManageProjects = computed(() => this.hasAnyRole(TECH_LEAD_AND_ABOVE));

  /** Excluir projetos: super admin, professor ou papel em MANAGER_ROLES. */
  protected readonly canDeleteProject = computed(() => this.hasAnyRole(MANAGER_ROLES));

  /** Labs onde o usuário pode criar projetos (select do dialog). */
  protected readonly createableLabs = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    if (user.is_super_admin || user.is_professor) return this.allLabs();
    const allowed = new Set(
      (user.lab_memberships ?? [])
        .filter(m => m.roles.some(r => TECH_LEAD_AND_ABOVE.includes(r as LabRole)))
        .map(m => m.lab_id),
    );
    return this.allLabs().filter(l => allowed.has(l.id));
  });

  private hasAnyRole(allowed: LabRole[]): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      m.roles.some(r => allowed.includes(r as LabRole)),
    );
  }

  ngOnInit(): void {
    const param = this.route.snapshot.queryParamMap.get('status');
    this.selectedStatus.set(param && PROJECT_STATUSES.includes(param) ? param : null);
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
    this.dashboardService.getProjects(this.selectedStatus() ?? undefined).subscribe({
      next: items => {
        this.projects.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Falha ao carregar os projetos.', 'Fechar', { duration: 4000 });
      },
    });
  }

  protected statusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  protected projectLink(p: DashboardProjectItem): (string | number)[] {
    return ['/labs', p.lab_id, 'projects', p.id];
  }

  protected openCreate(): void {
    const ref = this.dialog.open(ProjectFormDialog, {
      width: '520px',
      data: { labId: null, labs: this.createableLabs() },
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.snackBar.open('Projeto criado.', 'Fechar', { duration: 3000 });
        this.load();
      }
    });
  }

  protected openEdit(p: DashboardProjectItem): void {
    forkJoin({
      project: this.projectService.getById(p.lab_id, p.id),
      research: this.researchService.getAll(p.lab_id),
      members: this.memberService.getLabMembers(p.lab_id),
    }).subscribe({
      next: ({ project, research, members }) => {
        const techLeads = members.filter(m => m.roles?.includes(LabRole.TECH_LEAD));
        const ref = this.dialog.open(ProjectFormDialog, {
          width: '520px',
          data: { labId: p.lab_id, project, research, techLeads },
        });
        ref.afterClosed().subscribe(updated => {
          if (updated) {
            this.snackBar.open('Projeto atualizado.', 'Fechar', { duration: 3000 });
            this.load();
          }
        });
      },
      error: () =>
        this.snackBar.open('Falha ao carregar o projeto.', 'Fechar', { duration: 4000 }),
    });
  }

  protected deleteProject(p: DashboardProjectItem): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir projeto', message: `Excluir o projeto "${p.name}"?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deleting.update(s => {
        const n = new Set(s);
        n.add(p.id);
        return n;
      });
      this.projectService.delete(p.lab_id, p.id).subscribe({
        next: () => {
          this.deleting.update(s => {
            const n = new Set(s);
            n.delete(p.id);
            return n;
          });
          this.snackBar.open('Projeto excluído.', 'Fechar', { duration: 3000 });
          this.load();
        },
        error: () => {
          this.deleting.update(s => {
            const n = new Set(s);
            n.delete(p.id);
            return n;
          });
          this.snackBar.open('Falha ao excluir o projeto.', 'Fechar', { duration: 4000 });
        },
      });
    });
  }
}
