import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';

import {
  DashboardInventoryItem,
  LabRole,
  Laboratory,
  MANAGER_ROLES,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { LaboratoryService } from '../../../core/services/laboratory.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  InventoryFormDialog,
  InventoryFormData,
} from '../../laboratories/lab-detail/inventory-form-dialog';

@Component({
  selector: 'app-inventory-list',
  imports: [
    RouterLink,
    MatIcon,
    MatProgressSpinner,
    MatButton,
    MatIconButton,
    MatTooltip,
  ],
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss',
})
export class InventoryList implements OnInit {
  protected readonly items = signal<DashboardInventoryItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly allLabs = signal<Laboratory[]>([]);
  protected readonly labsLoading = signal(true);
  protected readonly deleting = signal<Set<number>>(new Set());

  protected readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly inventoryService = inject(InventoryService);
  private readonly labService = inject(LaboratoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Criar/editar/excluir inventário: super admin, professor ou papel em MANAGER_ROLES. */
  protected readonly canManageInventory = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.is_super_admin || user.is_professor) return true;
    return (user.lab_memberships ?? []).some(m =>
      m.roles.some(r => MANAGER_ROLES.includes(r as LabRole)),
    );
  });

  /** Labs onde o usuário pode criar itens (select do dialog). */
  protected readonly createableLabs = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    if (user.is_super_admin || user.is_professor) return this.allLabs();
    const allowed = new Set(
      (user.lab_memberships ?? [])
        .filter(m => m.roles.some(r => MANAGER_ROLES.includes(r as LabRole)))
        .map(m => m.lab_id),
    );
    return this.allLabs().filter(l => allowed.has(l.id));
  });

  ngOnInit(): void {
    this.load();
    this.labService.getAll().subscribe({
      next: labs => {
        this.allLabs.set(labs);
        this.labsLoading.set(false);
      },
      error: () => this.labsLoading.set(false),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.dashboardService.getInventory().subscribe({
      next: items => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load inventory.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected conditionLabel(condition: string): string {
    return condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  protected itemLink(i: DashboardInventoryItem): (string | number)[] {
    return ['/labs', i.lab_id];
  }

  protected openCreate(): void {
    const ref = this.dialog.open<InventoryFormDialog, InventoryFormData>(
      InventoryFormDialog,
      { width: '520px', data: { labId: null, labs: this.createableLabs() } },
    );
    ref.afterClosed().subscribe(created => {
      if (created) {
        this.snackBar.open('Item criado.', 'Dismiss', { duration: 3000 });
        this.load();
      }
    });
  }

  protected openEdit(i: DashboardInventoryItem): void {
    this.inventoryService.getById(i.lab_id, i.id).subscribe({
      next: item => {
        const ref = this.dialog.open<InventoryFormDialog, InventoryFormData>(
          InventoryFormDialog,
          { width: '520px', data: { labId: i.lab_id, item } },
        );
        ref.afterClosed().subscribe(updated => {
          if (updated) {
            this.snackBar.open('Item atualizado.', 'Dismiss', { duration: 3000 });
            this.load();
          }
        });
      },
      error: () =>
        this.snackBar.open('Falha ao carregar o item.', 'Dismiss', { duration: 4000 }),
    });
  }

  protected deleteItem(i: DashboardInventoryItem): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Delete Item', message: `Delete "${i.name}" from inventory?` },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deleting.update(s => {
        const n = new Set(s);
        n.add(i.id);
        return n;
      });
      this.inventoryService.delete(i.lab_id, i.id).subscribe({
        next: () => {
          this.deleting.update(s => {
            const n = new Set(s);
            n.delete(i.id);
            return n;
          });
          this.snackBar.open('Item excluído.', 'Dismiss', { duration: 3000 });
          this.load();
        },
        error: () => {
          this.deleting.update(s => {
            const n = new Set(s);
            n.delete(i.id);
            return n;
          });
          this.snackBar.open('Falha ao excluir o item.', 'Dismiss', { duration: 4000 });
        },
      });
    });
  }
}
