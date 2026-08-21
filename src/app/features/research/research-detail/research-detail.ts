import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
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
import { MatTooltip } from '@angular/material/tooltip';

import { LabMembership, LabRole, Member, Research } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberService } from '../../../core/services/member.service';
import { ResearchService } from '../../../core/services/research.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-research-detail',
  imports: [
    RouterLink,
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
    MatTooltip,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
  ],
  templateUrl: './research-detail.html',
  styleUrl: './research-detail.scss',
})
export class ResearchDetail implements OnInit {
  protected readonly research = signal<Research | null>(null);
  protected readonly loading = signal(true);
  protected readonly selectedMemberId = signal<number | null>(null);
  protected readonly labMembers = signal<LabMembership[]>([]);
  protected readonly currentMembership = signal<LabMembership | null>(null);

  protected readonly availableMembers = computed(() => {
    const inResearch = new Set(this.research()?.members?.map(m => m.id) ?? []);
    return this.labMembers().filter(lm => !inResearch.has(lm.member_id));
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  private readonly memberService = inject(MemberService);
  private readonly researchService = inject(ResearchService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labId = 0;
  protected researchId = 0;

  readonly memberColumns = ['name', 'email', 'actions'];

  protected readonly canManageMembers = computed(() => {
    if (this.authService.currentUser()?.is_super_admin) return true;
    const m = this.currentMembership();
    return m ? (m.roles?.includes(LabRole.LAB_COORDINATOR) || m.roles?.includes(LabRole.CHIEF_SCIENTIST)) : false;
  });

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
    this.researchId = Number(this.route.snapshot.paramMap.get('researchId'));
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
    this.researchService.getById(this.labId, this.researchId).subscribe({
      next: r => {
        this.research.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Grupo de pesquisa não encontrado', 'Fechar', { duration: 3000 });
        this.router.navigate(['/labs', this.labId]);
      },
    });
  }

  protected addMember(): void {
    const id = this.selectedMemberId();
    if (!id) return;
    this.researchService.addMember(this.labId, this.researchId, id).subscribe({
      next: r => {
        this.research.set(r);
        this.selectedMemberId.set(null);
        this.snackBar.open('Membro adicionado', 'Fechar', { duration: 2000 });
      },
      error: err =>
        this.snackBar.open(err.error?.message ?? 'Falha ao adicionar membro', 'Fechar', {
          duration: 3000,
        }),
    });
  }

  protected removeMember(member: Member): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Remover membro',
        message: `Remover ${member.first_name} ${member.last_name} deste grupo de pesquisa?`,
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.researchService.removeMember(this.labId, this.researchId, member.id).subscribe({
        next: () =>
          this.research.update(r =>
            r ? { ...r, members: r.members?.filter(m => m.id !== member.id) } : r,
          ),
      });
    });
  }
}
