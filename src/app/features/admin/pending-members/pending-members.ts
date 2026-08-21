import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { environment } from '../../../../environments/environment';
import { MatChip } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { MatTooltip } from '@angular/material/tooltip';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
} from '@angular/material/table';

import { Member } from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';
import { ManageLabsDialog } from '../manage-labs-dialog';

@Component({
  selector: 'app-pending-members',
  imports: [
    DatePipe,
    MatButton,
    MatIconButton,
    MatCell,
    MatCellDef,
    MatChip,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatIcon,
    MatNoDataRow,
    MatProgressSpinner,
    MatRow,
    MatRowDef,
    MatTab,
    MatTabGroup,
    MatTable,
    MatTooltip,
  ],
  templateUrl: './pending-members.html',
  styleUrl: './pending-members.scss',
})
export class PendingMembers implements OnInit {
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);

  protected readonly isDevMode = !environment.production;
  protected readonly loading = signal(true);
  protected readonly loadingAll = signal(true);
  protected readonly pending = signal<Member[]>([]);
  protected readonly allMembers = signal<Member[]>([]);
  protected readonly approving = signal<Set<number>>(new Set());
  protected readonly toggling = signal<Set<number>>(new Set());
  protected readonly resetting = signal(false);
  protected readonly selectedTabIndex = signal(0);

  protected readonly pendingColumns = ['name', 'email', 'cpf', 'desired_lab', 'registered', 'actions'];
  protected readonly allColumns = ['name', 'email', 'cpf', 'role', 'status', 'registered', 'actions'];

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'all') {
      this.selectedTabIndex.set(1);
    }
    this.memberService.getPendingMembers().subscribe({
      next: members => { this.pending.set(members); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.memberService.getAllMembers().subscribe({
      next: members => { this.allMembers.set(members); this.loadingAll.set(false); },
      error: () => this.loadingAll.set(false),
    });
  }

  protected approve(member: Member): void {
    this.setApproving(member.id, true);
    this.memberService.approveMember(member.id).subscribe({
      next: updated => {
        this.pending.update(list => list.filter(m => m.id !== member.id));
        this.allMembers.update(list => list.map(m => m.id === member.id ? updated : m));
        this.setApproving(member.id, false);
        this.snackBar.open(`${member.first_name} ${member.last_name} approved.`, 'Dismiss', { duration: 4000 });
      },
      error: () => {
        this.setApproving(member.id, false);
        this.snackBar.open('Failed to approve member.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected toggleActive(member: Member): void {
    this.setToggling(member.id, true);
    const call = member.is_active
      ? this.memberService.deactivateMember(member.id)
      : this.memberService.activateMember(member.id);
    call.subscribe({
      next: updated => {
        this.allMembers.update(list => list.map(m => m.id === member.id ? updated : m));
        this.setToggling(member.id, false);
        const action = updated.is_active ? 'activated' : 'deactivated';
        this.snackBar.open(`${member.first_name} ${member.last_name} ${action}.`, 'Dismiss', { duration: 4000 });
      },
      error: () => {
        this.setToggling(member.id, false);
        this.snackBar.open('Failed to update member status.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  private setApproving(id: number, on: boolean): void {
    this.approving.update(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  }

  private setToggling(id: number, on: boolean): void {
    this.toggling.update(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  }

  protected resetDb(): void {
    if (!confirm('Reset the database? All data will be wiped and re-seeded.')) return;
    this.resetting.set(true);
    this.memberService.debugResetDb().subscribe({
      next: () => {
        this.resetting.set(false);
        this.snackBar.open('Database reset. Reload the page.', 'Reload', { duration: 8000 })
          .onAction().subscribe(() => location.reload());
      },
      error: () => {
        this.resetting.set(false);
        this.snackBar.open('DB reset failed — check backend logs.', 'Dismiss', { duration: 6000 });
      },
    });
  }

  protected formatCpf(cpf: string | null | undefined): string {
    if (!cpf || cpf.length !== 11) return cpf ?? '—';
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  protected roleLabel(m: Member): string {
    if (m.is_super_admin) return 'Super Admin';
    if (m.is_professor) return 'Professor';
    return 'Member';
  }

  protected manageLabs(member: Member): void {
    this.dialog.open(ManageLabsDialog, {
      width: '480px',
      data: { member },
    });
  }
}
