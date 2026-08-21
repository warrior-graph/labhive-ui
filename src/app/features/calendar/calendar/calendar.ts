import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CalendarEvent, CalendarEventType } from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';

type CalendarFilter = 'all' | CalendarEventType;

@Component({
  selector: 'app-calendar',
  imports: [RouterLink, MatButton, MatIconButton, MatIcon, MatProgressSpinner],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnInit {
  private static readonly STATUS_LABELS: Record<string, string> = {
    planned: 'Planejada',
    in_progress: 'Em andamento',
    on_hold: 'Em espera',
    under_review: 'Em revisão',
    accepted: 'Aceita',
    rejected: 'Rejeitada',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    active: 'Ativo',
  };

  protected readonly filters: CalendarFilter[] = ['all', 'activity', 'project'];

  protected readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedFilter = signal<CalendarFilter>('all');
  protected readonly selectedDate = signal<string | null>(null);

  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly monthLabel = computed(() =>
    this.month().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );

  protected readonly selectedDayLabel = computed(() => {
    const key = this.selectedDate();
    if (!key) return '';
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  protected readonly weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  /** Monday-first grid of cells; null = leading blank cell from the previous month. */
  protected readonly days = computed<(Date | null)[]>(() => {
    const m = this.month();
    const year = m.getFullYear();
    const month = m.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  });

  protected readonly filteredEvents = computed(() =>
    this.events().filter(e =>
      this.selectedFilter() === 'all' || e.type === this.selectedFilter(),
    ),
  );

  protected readonly selectedDayEvents = computed(() => {
    const key = this.selectedDate();
    if (!key) return [];
    return this.filteredEvents().filter(e => e.date === key);
  });

  protected readonly todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  ngOnInit(): void {
    this.load();
  }

  protected monthKey(): string {
    const m = this.month();
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  }

  protected load(): void {
    this.loading.set(true);
    this.dashboardService.getCalendarEvents(this.monthKey()).subscribe({
      next: items => {
        this.events.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Falha ao carregar o calendário.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  protected shiftMonth(delta: number): void {
    const m = new Date(this.month());
    m.setMonth(m.getMonth() + delta);
    this.month.set(new Date(m.getFullYear(), m.getMonth(), 1));
    this.selectedDate.set(null);
    this.load();
  }

  protected goToday(): void {
    const now = new Date();
    this.month.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.selectedDate.set(this.todayKey);
    this.load();
  }

  protected filterLabel(filter: CalendarFilter): string {
    if (filter === 'activity') return 'Atividades';
    if (filter === 'project') return 'Projetos';
    return 'Todos';
  }

  protected selectFilter(filter: CalendarFilter): void {
    this.selectedFilter.set(filter);
  }

  protected selectDay(day: Date): void {
    this.selectedDate.set(this.dateKey(day));
  }

  protected dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected isToday(day: Date): boolean {
    return this.dateKey(day) === this.todayKey;
  }

  protected isSelected(day: Date): boolean {
    return this.dateKey(day) === this.selectedDate();
  }

  /** Events of a single day (used by the day cells). */
  protected eventsForDate(day: Date): CalendarEvent[] {
    const key = this.dateKey(day);
    return this.filteredEvents().filter(e => e.date === key);
  }

  protected eventLink(e: CalendarEvent): (string | number)[] {
    if (e.type === 'project') {
      return ['/labs', e.lab_id, 'projects', e.id];
    }
    return ['/labs', e.lab_id, 'activities', e.id];
  }

  protected statusLabel(status: string): string {
    return (
      Calendar.STATUS_LABELS[status] ??
      status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    );
  }
}