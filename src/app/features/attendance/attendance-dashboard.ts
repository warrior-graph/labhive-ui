import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  AttendanceDashboardData,
  AttendanceGranularity,
  AttendanceMember,
  AttendancePoint,
} from '../../core/models';
import { AttendanceService } from '../../core/services/attendance.service';

@Component({
  selector: 'app-attendance-dashboard',
  imports: [
    RouterLink,
    MatButton,
    MatIcon,
    MatProgressSpinner,
    MatSelectModule,
  ],
  templateUrl: './attendance-dashboard.html',
  styleUrl: './attendance-dashboard.scss',
})
export class AttendanceDashboard implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly attendanceService = inject(AttendanceService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<AttendanceDashboardData | null>(null);
  protected readonly granularity = signal<AttendanceGranularity>('week');
  protected readonly selectedSeries = signal<string>('lab');
  protected readonly targetDrafts = signal<Record<number, string>>({});
  protected readonly saving = signal<Set<number>>(new Set());
  protected readonly labId = Number(this.route.snapshot.paramMap.get('labId'));

  protected readonly chartSeries = computed<AttendancePoint[]>(() => {
    const dashboard = this.data();
    if (!dashboard) return [];
    if (this.selectedSeries() === 'lab') return dashboard.lab_series;
    const memberId = Number(this.selectedSeries());
    return dashboard.members.find(member => member.member_id === memberId)?.series ?? [];
  });

  protected readonly chartTitle = computed(() => {
    if (this.selectedSeries() === 'lab') return 'Média do laboratório';
    return this.data()?.members.find(
      member => member.member_id === Number(this.selectedSeries()),
    )?.name ?? 'Membro';
  });

  protected readonly chartMaximum = computed(() => {
    const values = this.chartSeries().flatMap(point => [
      point.actual_minutes,
      point.expected_minutes ?? 0,
    ]);
    const maximum = Math.max(60, ...values);
    return Math.ceil(maximum / 60) * 60;
  });

  protected readonly chartTicks = computed(() => {
    const maximum = this.chartMaximum();
    return [1, 0.75, 0.5, 0.25, 0].map(ratio => ({
      minutes: maximum * ratio,
      label: this.formatAxisHours(maximum * ratio),
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.attendanceService.getDashboard(this.labId, this.granularity(), 12).subscribe({
      next: dashboard => {
        this.data.set(dashboard);
        this.targetDrafts.set(Object.fromEntries(
          dashboard.members.map(member => [
            member.member_id,
            member.weekly_target_minutes === null
              ? ''
              : String(member.weekly_target_minutes / 60),
          ]),
        ));
        if (
          this.selectedSeries() !== 'lab'
          && !dashboard.members.some(member => String(member.member_id) === this.selectedSeries())
        ) {
          this.selectedSeries.set('lab');
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Não foi possível carregar os dados de frequência.');
      },
    });
  }

  protected changeGranularity(value: AttendanceGranularity): void {
    if (value === this.granularity()) return;
    this.granularity.set(value);
    this.load();
  }

  protected selectSeries(value: string): void {
    this.selectedSeries.set(value);
  }

  protected updateDraft(memberId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.targetDrafts.update(drafts => ({ ...drafts, [memberId]: value }));
  }

  protected saveTarget(member: AttendanceMember): void {
    const raw = this.targetDrafts()[member.member_id]?.trim() ?? '';
    const hours = raw === '' ? null : Number(raw.replace(',', '.'));
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 168)) {
      this.snackBar.open('Informe uma meta entre 0 e 168 horas por semana.', 'Fechar', { duration: 5000 });
      return;
    }
    this.setSaving(member.member_id, true);
    this.attendanceService.updateTarget(this.labId, member.member_id, hours).subscribe({
      next: () => {
        this.setSaving(member.member_id, false);
        this.snackBar.open(`Meta de ${member.name} atualizada.`, 'Fechar', { duration: 3000 });
        this.load();
      },
      error: () => {
        this.setSaving(member.member_id, false);
        this.snackBar.open('Não foi possível atualizar a meta.', 'Fechar', { duration: 5000 });
      },
    });
  }

  protected showMember(member: AttendanceMember): void {
    this.selectedSeries.set(String(member.member_id));
    document.querySelector('.attendance-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  protected barHeight(minutes: number | null): number {
    if (!minutes) return 0;
    return Math.max(2, Math.min(100, minutes / this.chartMaximum() * 100));
  }

  protected formatHours(minutes: number | null): string {
    if (minutes === null) return 'Sem meta';
    const hours = minutes / 60;
    return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  }

  protected formatExactDuration(minutes: number | null): string {
    if (minutes === null) return 'Sem meta configurada';
    const rounded = Math.max(0, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const remainingMinutes = rounded % 60;
    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours} h`;
    return `${hours} h ${remainingMinutes} min`;
  }

  protected formatAxisHours(minutes: number): string {
    return `${(minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
  }

  protected achievementLabel(value: number | null): string {
    return value === null ? 'Sem meta' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }

  protected periodLabel(point: AttendancePoint): string {
    const date = new Date(`${point.starts_on}T12:00:00`);
    return this.granularity() === 'week'
      ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
  }

  private setSaving(memberId: number, active: boolean): void {
    this.saving.update(current => {
      const next = new Set(current);
      if (active) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }
}
