import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { AfterViewInit, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatOption } from '@angular/material/core';
import { MatSelect, MatSelectTrigger } from '@angular/material/select';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
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
  MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';

import {
  Article,
  ARTICLE_STATUS_LABELS,
  ArticleStatus,
  InventoryItem,
  ItemCondition,
  ITEM_CONDITION_LABELS,
  LabMembership,
  LabRole,
  MANAGER_ROLES,
  Project,
  Research,
  RESEARCHER_AND_ABOVE,
  ROLE_LEVEL,
  TECH_LEAD_AND_ABOVE,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { ArticleService } from '../../../core/services/article.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { MemberService } from '../../../core/services/member.service';
import { ProjectService } from '../../../core/services/project.service';
import { ResearchService } from '../../../core/services/research.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { RoleBadge } from '../../../shared/components/role-badge/role-badge';
import { EditMemberDialog, EditMemberData } from './edit-member-dialog';
import { InviteDialog } from './invite-dialog';
import { MemberFormDialog } from './member-form-dialog';
import { ProjectFormDialog } from './project-form-dialog';
import { ResearchFormDialog } from './research-form-dialog';
import { InventoryFormDialog, InventoryFormData } from './inventory-form-dialog';
import { Laboratory } from '../../../core/models';

@Component({
  selector: 'app-lab-detail',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    MatTabGroup,
    MatTab,
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
    MatSort,
    MatSortHeader,
    MatOption,
    MatSelect,
    MatSelectTrigger,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
    RoleBadge,
  ],
  templateUrl: './lab-detail.html',
  styleUrl: './lab-detail.scss',
})
export class LabDetail implements OnInit, AfterViewInit {
  @ViewChild('articleSort') articleSort!: MatSort;

  protected readonly lab = signal<Laboratory | null>(null);
  protected readonly members = signal<LabMembership[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly research = signal<Research[]>([]);
  protected readonly articlesDataSource = new MatTableDataSource<Article>([]);
  protected readonly inventory = signal<InventoryItem[]>([]);
  protected readonly loading = signal(true);
  protected selectedTabIndex = 0;
  protected readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly labService = inject(LaboratoryService);
  private readonly memberService = inject(MemberService);
  private readonly projectService = inject(ProjectService);
  private readonly researchService = inject(ResearchService);
  private readonly articleService = inject(ArticleService);
  private readonly inventoryService = inject(InventoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected labId = 0;

  protected readonly articleStatusLabels = ARTICLE_STATUS_LABELS;
  protected readonly itemConditionLabels = ITEM_CONDITION_LABELS;
  protected readonly articleStatuses = Object.values(ArticleStatus);

  protected articleStatusLabel(status: string): string {
    return ARTICLE_STATUS_LABELS[status as ArticleStatus] ?? status;
  }

  protected itemConditionLabel(condition: string): string {
    return ITEM_CONDITION_LABELS[condition as ItemCondition] ?? condition;
  }

  protected readonly isSuperAdmin = computed(
    () => this.authService.currentUser()?.is_super_admin ?? false,
  );

  protected readonly currentMembership = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return null;
    return this.members().find(m => m.member_id === userId) ?? null;
  });

  protected readonly isCeo = computed(() => {
    if (this.isSuperAdmin()) return true;
    const m = this.currentMembership();
    return m?.roles?.includes(LabRole.LAB_COORDINATOR) ?? false;
  });

  protected readonly isChiefScientist = computed(() => {
    if (this.isSuperAdmin()) return true;
    const m = this.currentMembership();
    return m ? (m.roles?.includes(LabRole.LAB_COORDINATOR) || m.roles?.includes(LabRole.CHIEF_SCIENTIST)) : false;
  });

  protected readonly isManager = computed(() => {
    if (this.isSuperAdmin()) return true;
    const m = this.currentMembership();
    return m ? m.roles?.some(r => MANAGER_ROLES.includes(r as LabRole)) : false;
  });

  protected readonly isTechLead = computed(() => {
    if (this.isSuperAdmin()) return true;
    const m = this.currentMembership();
    return m ? m.roles?.some(r => TECH_LEAD_AND_ABOVE.includes(r as LabRole)) : false;
  });

  protected readonly isResearcher = computed(() => {
    if (this.isSuperAdmin()) return true;
    const m = this.currentMembership();
    return m ? m.roles?.some(r => RESEARCHER_AND_ABOVE.includes(r as LabRole)) : false;
  });

  protected readonly currentLevel = computed(() => {
    const roles = this.currentMembership()?.roles;
    if (!roles?.length) return 99;
    return Math.min(...roles.map(r => ROLE_LEVEL[r as LabRole] ?? 99));
  });

  protected canManage(m: LabMembership): boolean {
    if (this.isSuperAdmin()) return true;
    const myLevel = this.currentLevel();
    const targetLevel = m.roles?.length
      ? Math.min(...m.roles.map(r => ROLE_LEVEL[r as LabRole] ?? 99))
      : 99;
    return myLevel < targetLevel;
  }

  protected readonly canAddMember = computed(() =>
    this.isSuperAdmin() || this.currentLevel() < 4
  );

  readonly memberColumns = ['name', 'email', 'role', 'specialization', 'compensation', 'status', 'actions'];
  readonly projectColumns = ['name', 'status', 'start_date', 'end_date', 'actions'];
  readonly researchColumns = ['name', 'description', 'members', 'actions'];
  readonly articleColumns = ['title', 'status', 'conference', 'submission_deadline', 'in_charge', 'authors', 'actions'];
  readonly inventoryColumns = ['name', 'category', 'quantity', 'condition', 'serial_number', 'assigned_to', 'actions'];

  // Tab index constants
  static readonly TAB_ARTICLES = 3;

  ngOnInit(): void {
    this.labId = Number(this.route.snapshot.paramMap.get('labId'));
    // FIX 3: Restore tab from query param
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam !== null) {
      this.selectedTabIndex = Number(tabParam);
    }
    this.loadAll();
  }

  ngAfterViewInit(): void {
    // FIX 1: If the articles tab is already selected on load (e.g. via ?tab=3),
    // attach sort after the tab content has had time to render.
    if (this.selectedTabIndex === LabDetail.TAB_ARTICLES) {
      this.attachSortWithRetry();
    }
  }

  private attachSortWithRetry(attempts = 0): void {
    if (this.articleSort) {
      this.articlesDataSource.sort = this.articleSort;
    } else if (attempts < 10) {
      setTimeout(() => this.attachSortWithRetry(attempts + 1), 50);
    }
  }

  // FIX 1 + FIX 3: Called by (selectedTabChange) on MatTabGroup
  protected onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // Persist tab in URL without navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Re-attach sort when articles tab (index 3) becomes active
    if (index === LabDetail.TAB_ARTICLES) {
      this.attachSortWithRetry();
    }
  }

  protected loadAll(): void {
    this.loading.set(true);
    this.labService.getById(this.labId).subscribe({
      next: lab => {
        this.lab.set(lab);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Falha ao carregar laboratório', 'Fechar', { duration: 3000 });
        this.router.navigate(['/labs']);
      },
    });

    this.memberService.getLabMembers(this.labId).subscribe({
      next: members => {
        this.members.set(members);
      },
    });

    this.projectService.getAll(this.labId).subscribe({
      next: projects => this.projects.set(projects),
    });

    this.researchService.getAll(this.labId).subscribe({
      next: research => this.research.set(research),
    });

    this.articleService.getAll(this.labId).subscribe({
      next: articles => {
        this.articlesDataSource.data = articles;
      },
    });

    this.inventoryService.getAll(this.labId).subscribe({
      next: items => this.inventory.set(items),
    });
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  protected openAddMember(): void {
    const ref = this.dialog.open(MemberFormDialog, {
      width: '520px',
      data: { labId: this.labId, requesterRoleLevel: this.isSuperAdmin() ? -1 : this.currentLevel() },
    });
    ref.afterClosed().subscribe(added => {
      if (added) {
        this.memberService.getLabMembers(this.labId).subscribe(m => this.members.set(m));
      }
    });
  }

  protected openEditMember(m: LabMembership): void {
    const ref = this.dialog.open<EditMemberDialog, EditMemberData, LabMembership>(EditMemberDialog, {
      width: '480px',
      data: {
        labId: this.labId,
        membership: m,
        requesterRoleLevel: this.isSuperAdmin() ? -1 : this.currentLevel(),
        labMembers: this.members().filter(x => x.member_id !== m.member_id),
      },
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.members.update(ms => ms.map(x =>
          x.member_id === updated.member_id ? { ...x, ...updated } : x
        ));
        this.snackBar.open('Membro atualizado', 'Fechar', { duration: 2000 });
      }
    });
  }

  protected removeMember(memberId: number, name: string): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Remover Membro', message: `Remover ${name} deste laboratório?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.memberService.removeMember(this.labId, memberId).subscribe({
        next: () => {
          this.members.update(ms => ms.filter(m => m.member_id !== memberId));
          this.snackBar.open('Membro removido', 'Fechar', { duration: 2000 });
        },
        error: () => this.snackBar.open('Falha ao remover membro', 'Fechar', { duration: 3000 }),
      });
    });
  }

  /** Desliga (leave) ou reintegra (rejoin) um membro, conforme left_at. */
  protected toggleMembership(m: LabMembership): void {
    const name = `${m.member?.first_name ?? ''} ${m.member?.last_name ?? ''}`.trim();
    const reinstating = !!m.left_at;

    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: reinstating
        ? {
            title: 'Reintegrar Membro',
            message: `Reintegrar a associação de ${name} a este laboratório?`,
            confirmLabel: 'Reintegrar',
          }
        : {
            title: 'Desativar Associação',
            message: `Desativar a associação de ${name} a este laboratório? Ele(a) pode ser reintegrado(a) depois.`,
            confirmLabel: 'Desativar',
          },
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const call = reinstating
        ? this.memberService.rejoinMember(this.labId, m.member_id)
        : this.memberService.leaveMember(this.labId, m.member_id);
      call.subscribe({
        next: updated => {
          this.members.update(ms =>
            ms.map(x => (x.member_id === updated.member_id ? { ...x, ...updated } : x)),
          );
          this.snackBar.open(
            reinstating ? `${name} reintegrado(a)` : `${name} desativado(a)`,
            'Fechar',
            { duration: 2000 },
          );
        },
        error: () =>
          this.snackBar.open(
            reinstating ? 'Falha ao reintegrar membro' : 'Falha ao desativar membro',
            'Fechar',
            { duration: 3000 },
          ),
      });
    });
  }

  /** Abre o dialog de geração de convite por link (MANAGER_ROLES). */
  protected openInviteDialog(): void {
    this.dialog.open(InviteDialog, {
      width: '480px',
      data: { labId: this.labId, labName: this.lab()?.name ?? `Laboratório #${this.labId}` },
    });
  }

  // ─── Projects ──────────────────────────────────────────────────────────────

  protected openAddProject(): void {
    const techLeads = this.members().filter(m => m.roles?.includes(LabRole.TECH_LEAD));
    const ref = this.dialog.open(ProjectFormDialog, {
      width: '520px',
      data: { labId: this.labId, research: this.research(), techLeads },
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.projectService.getAll(this.labId).subscribe(p => this.projects.set(p));
      }
    });
  }

  protected deleteProject(projectId: number, name: string): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir Projeto', message: `Excluir o projeto "${name}"?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.projectService.delete(this.labId, projectId).subscribe({
        next: () => {
          this.projects.update(ps => ps.filter(p => p.id !== projectId));
          this.snackBar.open('Projeto excluído', 'Fechar', { duration: 2000 });
        },
        error: () => this.snackBar.open('Falha ao excluir projeto', 'Fechar', { duration: 3000 }),
      });
    });
  }

  protected toggleProject(project: Project): void {
    const call = project.is_active
      ? this.projectService.deactivate(this.labId, project.id)
      : this.projectService.activate(this.labId, project.id);
    call.subscribe({
      next: updated => {
        this.projects.update(ps => ps.map(p => p.id === project.id ? updated : p));
        this.snackBar.open(`Projeto ${updated.is_active ? 'ativado' : 'desativado'}.`, 'Fechar', { duration: 2000 });
      },
      error: () => this.snackBar.open('Falha ao atualizar o status do projeto.', 'Fechar', { duration: 3000 }),
    });
  }

  // ─── Research ──────────────────────────────────────────────────────────────

  protected openAddResearch(): void {
    const chiefScientists = this.members().filter(
      m => m.roles?.some(r => r === LabRole.CHIEF_SCIENTIST || r === LabRole.LAB_COORDINATOR)
    );
    const ref = this.dialog.open(ResearchFormDialog, {
      width: '480px',
      data: { labId: this.labId, labMembers: chiefScientists },
    });
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.researchService.getAll(this.labId).subscribe(r => this.research.set(r));
      }
    });
  }

  protected deleteResearch(researchId: number, name: string): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir Grupo de Pesquisa', message: `Excluir "${name}"?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.researchService.delete(this.labId, researchId).subscribe({
        next: () => {
          this.research.update(rs => rs.filter(r => r.id !== researchId));
          this.snackBar.open('Grupo de pesquisa excluído', 'Fechar', { duration: 2000 });
        },
        error: () => this.snackBar.open('Falha ao excluir grupo de pesquisa', 'Fechar', { duration: 3000 }),
      });
    });
  }

  protected toggleResearch(group: Research): void {
    const call = group.is_active
      ? this.researchService.deactivate(this.labId, group.id)
      : this.researchService.activate(this.labId, group.id);
    call.subscribe({
      next: updated => {
        this.research.update(rs => rs.map(r => r.id === group.id ? updated : r));
        this.snackBar.open(`Grupo de pesquisa ${updated.is_active ? 'ativado' : 'desativado'}.`, 'Fechar', { duration: 2000 });
      },
      error: () => this.snackBar.open('Falha ao atualizar o status do grupo de pesquisa.', 'Fechar', { duration: 3000 }),
    });
  }

  // ─── Articles ──────────────────────────────────────────────────────────────

  protected changeArticleStatus(article: Article, newStatus: ArticleStatus): void {
    this.articleService.update(this.labId, article.id, { status: newStatus }).subscribe({
      next: updated => {
        this.articlesDataSource.data = this.articlesDataSource.data.map(a =>
          a.id === updated.id ? updated : a
        );
      },
      error: () => this.snackBar.open('Falha ao atualizar o status', 'Fechar', { duration: 3000 }),
    });
  }

  protected deleteArticle(articleId: number, title: string): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir Artigo', message: `Excluir "${title}"?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.articleService.delete(this.labId, articleId).subscribe({
        next: () => {
          this.articlesDataSource.data = this.articlesDataSource.data.filter(a => a.id !== articleId);
          this.snackBar.open('Artigo excluído', 'Fechar', { duration: 2000 });
        },
        error: () => this.snackBar.open('Falha ao excluir artigo', 'Fechar', { duration: 3000 }),
      });
    });
  }

  protected toggleArticle(article: Article): void {
    const call = article.is_active
      ? this.articleService.deactivate(this.labId, article.id)
      : this.articleService.activate(this.labId, article.id);
    call.subscribe({
      next: updated => {
        this.articlesDataSource.data = this.articlesDataSource.data.map(a =>
          a.id === article.id ? updated : a
        );
        this.snackBar.open(`Artigo ${updated.is_active ? 'ativado' : 'desativado'}.`, 'Fechar', { duration: 2000 });
      },
      error: () => this.snackBar.open('Falha ao atualizar o status do artigo.', 'Fechar', { duration: 3000 }),
    });
  }

  // ─── Inventory ─────────────────────────────────────────────────────────────

  protected openAddInventoryItem(): void {
    const ref = this.dialog.open<InventoryFormDialog, InventoryFormData, InventoryItem>(
      InventoryFormDialog,
      { width: '520px', data: { labId: this.labId } },
    );
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.inventory.update(items => [...items, created]);
        this.snackBar.open('Item adicionado', 'Fechar', { duration: 2000 });
      }
    });
  }

  protected openEditInventoryItem(item: InventoryItem): void {
    const ref = this.dialog.open<InventoryFormDialog, InventoryFormData, InventoryItem>(
      InventoryFormDialog,
      { width: '520px', data: { labId: this.labId, item } },
    );
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.inventory.update(items => items.map(i => i.id === updated.id ? updated : i));
        this.snackBar.open('Item atualizado', 'Fechar', { duration: 2000 });
      }
    });
  }

  protected deleteInventoryItem(itemId: number, name: string): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir Item', message: `Excluir "${name}" do inventário?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.inventoryService.delete(this.labId, itemId).subscribe({
        next: () => {
          this.inventory.update(items => items.filter(i => i.id !== itemId));
          this.snackBar.open('Item excluído', 'Fechar', { duration: 2000 });
        },
        error: () => this.snackBar.open('Falha ao excluir item', 'Fechar', { duration: 3000 }),
      });
    });
  }

  // ─── Lab management ────────────────────────────────────────────────────────

  protected deleteLab(): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Excluir Laboratório',
        message: `Excluir permanentemente "${this.lab()?.name}"? Esta ação não pode ser desfeita.`,
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.labService.delete(this.labId).subscribe({
        next: () => this.router.navigate(['/labs']),
        error: () => this.snackBar.open('Falha ao excluir laboratório', 'Fechar', { duration: 3000 }),
      });
    });
  }
}
