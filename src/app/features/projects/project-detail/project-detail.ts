import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MatCellDef,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderRowDef,
  MatNoDataRow,
  MatRowDef,
  MatTable,
  MatHeaderCell,
  MatCell,
  MatHeaderRow,
  MatRow,
} from '@angular/material/table';
import { MatChipSet, MatChip } from '@angular/material/chips';
import { MatTooltip } from '@angular/material/tooltip';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';

import { LabMembership, LabRole, MANAGER_ROLES, Member, Project } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberService } from '../../../core/services/member.service';
import { ProjectService } from '../../../core/services/project.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-project-detail',
  imports: [
    RouterLink,
    DatePipe,
    TitleCasePipe,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTable,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatCell,
    MatCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatNoDataRow,
    MatChipSet,
    MatChip,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
  ],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
  protected readonly project = signal<Project | null>(null);
  protected readonly loading = signal(true);
  protected readonly selectedMemberId = signal<number | null>(null);
  protected readonly labMembers = signal<LabMembership[]>([]);
  protected readonly currentMembership = signal<LabMembership | null>(null);

  protected readonly availableMembers = computed(() => {
    const inProject = new Set(this.project()?.members?.map(m => m.id) ?? []);
    return this.labMembers().filter(lm => !inProject.has(lm.member_id));
  });

  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly memberService = inject(MemberService);
  private readonly projectService = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labId = 0;
  protected projectId = 0;

  readonly memberColumns = ['name', 'email', 'actions'];

  protected readonly canManageMembers = computed(() => {
    if (this.authService.currentUser()?.is_super_admin) return true;
    const m = this.currentMembership();
    if (!m) return false;
    return (
      m.roles?.includes(LabRole.LAB_COORDINATOR) ||
      m.roles?.includes(LabRole.ENGINEERING_MANAGER) ||
      m.roles?.includes(LabRole.PROJECT_MANAGER)
    ) ?? false;
  });

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
    this.projectId = Number(this.route.snapshot.paramMap.get('projectId'));
    this.load();
    this.memberService.getLabMembers(this.labId).subscribe({
      next: memberships => {
        this.labMembers.set(memberships);
        const userId = this.authService.currentUser()?.id;
        if (userId) {
          this.currentMembership.set(memberships.find(m => m.member_id === userId) ?? null);
        }
      },
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.projectService.getById(this.labId, this.projectId).subscribe({
      next: p => {
        this.project.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Projeto não encontrado', 'Fechar', { duration: 3000 });
        this.router.navigate(['/labs', this.labId]);
      },
    });
  }

  protected addMember(): void {
    const id = this.selectedMemberId();
    if (!id) return;
    this.projectService.addMember(this.labId, this.projectId, id).subscribe({
      next: p => {
        this.project.set(p);
        this.selectedMemberId.set(null);
        this.snackBar.open('Membro adicionado', 'Fechar', { duration: 2000 });
      },
      error: (err) =>
        this.snackBar.open(err.error?.message ?? 'Falha ao adicionar membro', 'Fechar', {
          duration: 3000,
        }),
    });
  }

  protected removeMember(member: Member): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Remover membro',
        message: `Remover ${member.first_name} ${member.last_name} deste projeto?`,
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.projectService.removeMember(this.labId, this.projectId, member.id).subscribe({
        next: () => {
          this.project.update(p =>
            p ? { ...p, members: p.members?.filter(m => m.id !== member.id) } : p,
          );
          this.snackBar.open('Membro removido', 'Fechar', { duration: 2000 });
        },
      });
    });
  }
}
