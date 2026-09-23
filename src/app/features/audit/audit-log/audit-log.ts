import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

import { AuditEntry, AuditPage } from '../../../core/models';
import { AuditService } from '../../../core/services/audit.service';
import { ExportService } from '../../../core/services/export.service';
import { extractApiError } from '../../../core/utils/api-error';

@Component({
  selector: 'app-audit-log',
  imports: [
    DatePipe,
    RouterLink,
    MatButton,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatFormField,
    MatLabel,
    MatIcon,
    MatOption,
    MatSelect,
    MatProgressSpinner,
  ],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auditApi = inject(AuditService);
  private readonly exports = inject(ExportService);

  protected readonly labId = Number(this.route.snapshot.paramMap.get('labId'));
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<AuditPage | null>(null);
  protected readonly actionFilter = signal<string>('');
  protected readonly limit = signal(100);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auditApi.listByLab(this.labId, {
      action: this.actionFilter() || undefined,
      limit: this.limit(),
    }).subscribe({
      next: page => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extractApiError(error, 'Não foi possível carregar a auditoria.'));
      },
    });
  }

  protected setAction(value: string): void {
    this.actionFilter.set(value);
    this.load();
  }

  protected setLimit(value: number): void {
    this.limit.set(value);
    this.load();
  }

  protected exportCsv(): void {
    this.exports.download(this.labId, 'audit');
  }

  /** Friendly pt-BR label for a machine-readable action key. */
  protected actionLabel(action: string): string {
    const labels: Record<string, string> = {
      'member.add': 'Membro adicionado',
      'member.rejoin': 'Membro readicionado',
      'member.remove': 'Membro removido',
      'member.role_update': 'Papéis alterados',
      'member.approve': 'Conta aprovada',
      'member.deactivate': 'Conta desativada',
      'member.activate': 'Conta reativada',
      'member.leave': 'Saída registrada',
      'member.import': 'Importação de membros',
      'member.profile_update': 'Perfil atualizado',
      'lab.create': 'Laboratório criado',
      'lab.update': 'Laboratório atualizado',
      'lab.delete': 'Laboratório excluído',
      'lab.deactivate': 'Laboratório desativado',
      'lab.activate': 'Laboratório reativado',
      'role.create': 'Papel criado',
      'role.delete': 'Papel excluído',
      'reservation.decide': 'Reserva decidida',
      'auth.mfa_enable': 'MFA ativado',
      'auth.mfa_disable': 'MFA desativado',
    };
    return labels[action] ?? action;
  }

  protected targetLabel(entry: AuditEntry): string {
    if (!entry.target_type) return '—';
    return entry.target_id ? `${entry.target_type} #${entry.target_id}` : entry.target_type;
  }
}
