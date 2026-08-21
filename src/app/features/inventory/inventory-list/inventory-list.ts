import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DashboardInventoryItem } from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-inventory-list',
  imports: [RouterLink, MatIcon, MatProgressSpinner],
  templateUrl: './inventory-list.html',
  styleUrl: './inventory-list.scss',
})
export class InventoryList implements OnInit {
  protected readonly items = signal<DashboardInventoryItem[]>([]);
  protected readonly loading = signal(true);

  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
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
}
