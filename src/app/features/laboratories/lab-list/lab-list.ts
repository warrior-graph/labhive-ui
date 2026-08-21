import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardActions, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatChip } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import { Laboratory } from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import { LabFormDialog } from './lab-form-dialog';

@Component({
  selector: 'app-lab-list',
  imports: [
    RouterLink,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCardActions,
    MatButton,
    MatChip,
    MatIcon,
    MatIconButton,
    MatProgressSpinner,
    MatTooltip,
  ],
  templateUrl: './lab-list.html',
  styleUrl: './lab-list.scss',
})
export class LabList implements OnInit {
  protected readonly labs = signal<Laboratory[]>([]);
  protected readonly loading = signal(true);
  protected readonly toggling = signal<Set<number>>(new Set());

  protected readonly myLabIds = computed(() =>
    new Set((this.authService.currentUser()?.lab_memberships ?? []).map(m => m.lab_id))
  );
  protected readonly myLabs = computed(() =>
    this.labs().filter(l => this.myLabIds().has(l.id))
  );
  protected readonly otherLabs = computed(() =>
    this.labs().filter(l => !this.myLabIds().has(l.id))
  );

  protected readonly authService = inject(AuthService);
  private readonly labService = inject(LaboratoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.labService.getAll().subscribe({
      next: labs => {
        this.labs.set(labs);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Falha ao carregar laboratórios', 'Fechar', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  protected openCreate(): void {
    const ref = this.dialog.open(LabFormDialog, { width: '480px' });
    ref.afterClosed().subscribe(created => {
      if (created) this.load();
    });
  }

  protected toggleActive(lab: Laboratory, event: Event): void {
    event.stopPropagation();
    this.toggling.update(s => { const n = new Set(s); n.add(lab.id); return n; });
    const call = lab.is_active ? this.labService.deactivate(lab.id) : this.labService.activate(lab.id);
    call.subscribe({
      next: updated => {
        this.labs.update(list => list.map(l => l.id === lab.id ? updated : l));
        this.toggling.update(s => { const n = new Set(s); n.delete(lab.id); return n; });
        this.snackBar.open(`${lab.name} ${updated.is_active ? 'ativado' : 'desativado'}.`, 'Fechar', { duration: 3000 });
      },
      error: () => {
        this.toggling.update(s => { const n = new Set(s); n.delete(lab.id); return n; });
        this.snackBar.open('Falha ao atualizar o status do laboratório.', 'Fechar', { duration: 3000 });
      },
    });
  }
}
