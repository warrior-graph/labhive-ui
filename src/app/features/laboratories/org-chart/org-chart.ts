import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';

import { LAB_ROLE_LABELS, LabMembership, LabRole, ROLE_LEVEL } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberService } from '../../../core/services/member.service';

interface TreeNode {
  membership: LabMembership;
  children: TreeNode[];
  parent: TreeNode | null;
}

@Component({
  selector: 'app-org-chart',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    MatButton,
    MatIconButton,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
  ],
  templateUrl: './org-chart.html',
  styleUrl: './org-chart.scss',
})
export class OrgChart implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly memberService = inject(MemberService);
  protected readonly authService = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly memberships = signal<LabMembership[]>([]);
  protected readonly labId = signal(0);

  /** null = full tree view; a member_id = focus view centred on that person */
  protected readonly focusedMemberId = signal<number | null>(null);

  /** Zoom factor (CSS zoom, keeps scroll area correct) */
  protected readonly zoom = signal(1);
  protected readonly panning = signal(false);
  private panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

  protected readonly memberMap = computed(() =>
    new Map(this.memberships().map(m => [m.member_id, m]))
  );

  protected readonly treeRoots = computed(() => this.buildTree(this.memberships()));

  protected readonly focusedNode = computed((): TreeNode | null => {
    const id = this.focusedMemberId();
    if (id === null) return null;
    return this.findNode(this.treeRoots(), id);
  });

  protected readonly focusedManager = computed((): LabMembership | null =>
    this.focusedNode()?.parent?.membership ?? null
  );

  protected readonly focusedPeers = computed((): TreeNode[] => {
    const node = this.focusedNode();
    if (!node) return [];
    const siblings = node.parent ? node.parent.children : this.treeRoots();
    return siblings.filter(s => s.membership.member_id !== node.membership.member_id);
  });

  protected readonly focusedReports = computed((): TreeNode[] =>
    this.focusedNode()?.children ?? []
  );

  protected focus(id: number | null): void {
    this.focusedMemberId.set(id);
  }

  // ── Zoom ────────────────────────────────────────────────────────────────

  protected zoomIn(): void {
    this.zoom.set(Math.min(1.5, +(this.zoom() + 0.2).toFixed(2)));
  }

  protected zoomOut(): void {
    this.zoom.set(Math.max(0.5, +(this.zoom() - 0.2).toFixed(2)));
  }

  protected resetZoom(): void {
    this.zoom.set(1);
  }

  protected zoomLabel(): string {
    return `${Math.round(this.zoom() * 100)}%`;
  }

  // ── Drag to pan ─────────────────────────────────────────────────────────

  protected onPanStart(event: MouseEvent, canvas: HTMLElement): void {
    const target = event.target as HTMLElement;
    if (target.closest('.org-card')) return; // não sequestrar cliques nos cards
    this.panning.set(true);
    this.panStart = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    };
  }

  protected onPanMove(event: MouseEvent, canvas: HTMLElement): void {
    if (!this.panning()) return;
    canvas.scrollLeft = this.panStart.scrollLeft - (event.clientX - this.panStart.x);
    canvas.scrollTop = this.panStart.scrollTop - (event.clientY - this.panStart.y);
  }

  protected onPanEnd(): void {
    this.panning.set(false);
  }

  protected roleLabel(role: string): string {
    return LAB_ROLE_LABELS[role as LabRole] ?? role;
  }

  protected roleLabels(roles: LabRole[]): string {
    return (roles ?? []).map(r => LAB_ROLE_LABELS[r] ?? r).join(', ');
  }

  private primaryRoleLevel(roles: LabRole[]): number {
    if (!roles?.length) return 99;
    return Math.min(...roles.map(r => ROLE_LEVEL[r] ?? 99));
  }

  protected initials(m: LabMembership): string {
    const first = m.member?.first_name?.[0] ?? '';
    const last = m.member?.last_name?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  protected isCurrentUser(m: LabMembership): boolean {
    return m.member_id === this.authService.currentUser()?.id;
  }

  protected managerName(m: LabMembership): string | null {
    if (m.reports_to_id == null) return null;
    const mgr = this.memberMap().get(m.reports_to_id);
    return mgr ? `${mgr.member?.first_name} ${mgr.member?.last_name}` : null;
  }

  private buildTree(memberships: LabMembership[]): TreeNode[] {
    const nodes = new Map<number, TreeNode>();
    for (const m of memberships) {
      nodes.set(m.member_id, { membership: m, children: [], parent: null });
    }

    for (const node of nodes.values()) {
      const m = node.membership;
      const resolvedId = m.resolved_reports_to_id;

      if (resolvedId != null && nodes.has(resolvedId) && resolvedId !== m.member_id) {
        const parentNode = nodes.get(resolvedId)!;
        parentNode.children.push(node);
        node.parent = parentNode;
      }
    }

    const sortNodes = (a: TreeNode, b: TreeNode): number => {
      const la = this.primaryRoleLevel(a.membership.roles as LabRole[]);
      const lb = this.primaryRoleLevel(b.membership.roles as LabRole[]);
      return la !== lb
        ? la - lb
        : (a.membership.member?.last_name ?? '').localeCompare(
            b.membership.member?.last_name ?? ''
          );
    };

    for (const node of nodes.values()) {
      node.children.sort(sortNodes);
    }

    return Array.from(nodes.values()).filter(n => n.parent === null).sort(sortNodes);
  }

  private findNode(nodes: TreeNode[], id: number): TreeNode | null {
    for (const node of nodes) {
      if (node.membership.member_id === id) return node;
      const found = this.findNode(node.children, id);
      if (found) return found;
    }
    return null;
  }

  ngOnInit(): void {
    const labId = Number(this.route.snapshot.paramMap.get('labId'));
    this.labId.set(labId);
    this.memberService.getOrg(labId).subscribe({
      next: res => {
        this.memberships.set(res.memberships ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
