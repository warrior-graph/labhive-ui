import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
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

import { environment } from '../../../../environments/environment';
import { Member } from '../../../core/models';
import { MemberService } from '../../../core/services/member.service';

@Component({
  selector: 'app-pending-members',
  imports: [
    DatePipe,
    MatButton,
    MatCell,
    MatCellDef,
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
    MatTable,
  ],
  templateUrl: './pending-members.html',
  styleUrl: './pending-members.scss',
})
export class PendingMembers implements OnInit {
  private readonly memberService = inject(MemberService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly isDevMode = !environment.production;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<Member[]>([]);
  protected readonly approving = signal<Set<number>>(new Set());
  protected readonly resetting = signal(false);
  protected readonly columns = ['name', 'email', 'cpf', 'desired_lab', 'registered', 'actions'];

  ngOnInit(): void {
    this.loadPending();
  }

  protected loadPending(): void {
    this.loading.set(true);
    this.error.set(null);
    this.memberService.getPendingMembers().subscribe({
      next: members => {
        this.pending.set(members);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set([]);
        this.loading.set(false);
        this.error.set(
          error.status === 403
            ? 'Você não tem permissão para aprovar cadastros neste laboratório.'
            : 'Não foi possível carregar as aprovações. Tente novamente.',
        );
      },
    });
  }

  protected approve(member: Member): void {
    this.setApproving(member.id, true);
    this.memberService.approveMember(member.id).subscribe({
      next: () => {
        this.pending.update(list => list.filter(item => item.id !== member.id));
        this.setApproving(member.id, false);
        this.snackBar.open(`${member.first_name} ${member.last_name} aprovado(a).`, 'Fechar', { duration: 4000 });
      },
      error: () => {
        this.setApproving(member.id, false);
        this.snackBar.open('Falha ao aprovar membro.', 'Fechar', { duration: 4000 });
      },
    });
  }

  private setApproving(id: number, on: boolean): void {
    this.approving.update(current => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected resetDb(): void {
    if (!confirm('Resetar o banco? Todos os dados serão apagados e recriados.')) return;
    this.resetting.set(true);
    this.memberService.debugResetDb().subscribe({
      next: () => {
        this.resetting.set(false);
        this.snackBar.open('Banco resetado. Recarregue a página.', 'Recarregar', { duration: 8000 })
          .onAction().subscribe(() => location.reload());
      },
      error: () => {
        this.resetting.set(false);
        this.snackBar.open('Falha ao resetar o banco — verifique os logs do servidor.', 'Fechar', { duration: 6000 });
      },
    });
  }

  protected formatCpf(cpf: string | null | undefined): string {
    if (!cpf || cpf.length !== 11) return cpf ?? '—';
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }
}
