import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from '@angular/material/datepicker';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { OccupancyReport, OccupancySpace } from '../../../core/models';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { extractApiError } from '../../../core/utils/api-error';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-occupancy',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCheckbox,
    MatDatepicker,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatFormField,
    MatLabel,
    MatSuffix,
    MatIcon,
    MatInput,
    MatProgressSpinner,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './occupancy.html',
  styleUrl: './occupancy.scss',
})
export class Occupancy implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly analytics = inject(AnalyticsService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly labId = Number(this.route.snapshot.paramMap.get('labId'));
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<OccupancyReport | null>(null);
  protected readonly includeInactive = signal(false);

  // Material datepickers need a real form control (or ngModel) to read/write
  // their value; binding `[value]` to a Date would stringify it.
  protected readonly sinceControl = new FormControl<Date>(this.daysAgo(30), {
    nonNullable: true,
  });
  protected readonly untilControl = new FormControl<Date>(new Date(), {
    nonNullable: true,
  });

  protected readonly busiest = computed(
    () => this.report()?.spaces[0] ?? null,
  );
  protected readonly underused = computed(() => {
    const spaces = this.report()?.spaces ?? [];
    return [...spaces].reverse().slice(0, 5);
  });
  protected readonly maxDayMinutes = computed(() => {
    const values = (this.report()?.days ?? []).map(day => day.booked_minutes);
    return Math.max(60, ...values);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.analytics.getOccupancy(this.labId, {
      since: this.startOfDay(this.sinceControl.value).toISOString(),
      until: this.endOfDay(this.untilControl.value).toISOString(),
      include_inactive: this.includeInactive(),
    }).subscribe({
      next: report => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(extractApiError(error, 'Não foi possível carregar a ocupação.'));
      },
    });
  }

  protected toggleInactive(): void {
    this.includeInactive.update(value => !value);
    this.load();
  }

  protected preset(days: number): void {
    this.sinceControl.setValue(this.daysAgo(days));
    this.untilControl.setValue(new Date());
    this.load();
  }

  protected rateClass(rate: number): string {
    if (rate >= 70) return 'high';
    if (rate >= 35) return 'medium';
    return 'low';
  }

  protected barWidth(space: OccupancySpace): number {
    return Math.max(2, Math.min(100, space.occupancy_rate));
  }

  protected dayBar(minutes: number): number {
    return Math.max(0, Math.min(100, (minutes / this.maxDayMinutes()) * 100));
  }

  protected formatHours(minutes: number): string {
    return `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  }

  protected formatRate(rate: number): string {
    return `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  protected dayLabel(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  protected typeLabel(type: string): string {
    const labels: Record<string, string> = {
      room: 'Sala',
      desk: 'Mesa',
      workstation: 'Estação',
      bench: 'Bancada',
      shared_area: 'Área compartilhada',
    };
    return labels[type] ?? type;
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.startOfDay(date);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }
}
