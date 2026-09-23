import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBadge } from '@angular/material/badge';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, interval, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { AppNotification, AppNotificationType, LabCapability } from '../../../core/models';
import { AnnouncementsService } from '../../../core/services/announcements.service';
import { ThemePreference, ThemeService } from '../../../core/services/theme.service';

interface NavItem { label: string; icon: string; route: () => unknown[]; capability?: LabCapability; }

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButton, MatIconButton, MatBadge,
    MatIcon, MatMenu, MatMenuTrigger, MatMenuItem, MatDivider, MatSelectModule,
    MatListModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sidebarOpen = signal(false);
  protected readonly commandOpen = signal(false);
  protected readonly commandQuery = signal('');
  protected readonly unreadCount = signal(0);
  protected readonly notifications = signal<AppNotification[]>([]);
  protected readonly activeLabId = this.authService.activeLabId;
  protected readonly activeLab = this.authService.activeMembership;
  protected readonly memberships = this.authService.memberships;

  protected readonly labItems: NavItem[] = [
    { label: 'Visão geral', icon: 'science', route: () => ['/labs', this.activeLabId()] },
    { label: 'Pessoas', icon: 'group', route: () => ['/labs', this.activeLabId(), 'org-chart'] },
    { label: 'Frequência', icon: 'monitoring', route: () => ['/labs', this.activeLabId(), 'attendance'], capability: 'attendance.view' },
    { label: 'Projetos', icon: 'workspaces', route: () => ['/projects'] },
    { label: 'Pesquisa', icon: 'biotech', route: () => ['/labs', this.activeLabId()] },
    { label: 'Atividades', icon: 'task_alt', route: () => ['/activities'] },
    { label: 'Espaços', icon: 'meeting_room', route: () => ['/labs', this.activeLabId(), 'spaces'] },
    { label: 'Inventário', icon: 'inventory_2', route: () => ['/inventory'] },
  ];

  protected readonly commands = computed(() => {
    const labId = this.activeLabId();
    const items = [
      { label: 'Ir para o início', hint: 'Meu trabalho', icon: 'home', route: ['/dashboard'] },
      { label: 'Abrir agenda', hint: 'Prazos e reservas', icon: 'calendar_month', route: ['/calendar'] },
      { label: 'Ver atividades', hint: 'Tarefas e revisões', icon: 'task_alt', route: ['/activities'] },
      { label: 'Ver projetos', hint: 'Projetos do laboratório', icon: 'workspaces', route: ['/projects'] },
      { label: 'Ler comunicados', hint: 'Notícias do laboratório', icon: 'campaign', route: ['/announcements'] },
      ...(labId ? [
        { label: 'Ver pessoas', hint: 'Equipe e organograma', icon: 'group', route: ['/labs', labId, 'org-chart'] },
        { label: 'Reservar um espaço', hint: 'Salas, bancadas e estações', icon: 'meeting_room', route: ['/labs', labId, 'spaces'] },
      ] : []),
    ];
    const query = this.commandQuery().trim().toLocaleLowerCase('pt-BR');
    return query ? items.filter(item => `${item.label} ${item.hint}`.toLocaleLowerCase('pt-BR').includes(query)) : items;
  });

  protected readonly canAdmin = computed(() =>
    this.authService.hasCapability('members.approve') || this.authService.hasGlobalCapability('admin.labs'),
  );

  constructor() {
    toObservable(this.authService.isAuthenticated).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(authenticated => !authenticated ? EMPTY : interval(60_000).pipe(
        startWith(0),
        switchMap(() => this.announcementsService.getUnreadCount().pipe(catchError(() => EMPTY))),
      )),
    ).subscribe(({ count }) => this.unreadCount.set(count));
  }

  protected canShowLabItem(item: NavItem): boolean {
    return !item.capability || this.authService.hasCapability(item.capability);
  }

  protected selectLab(labId: number): void {
    const previous = this.activeLabId();
    this.authService.selectLab(labId);
    const url = this.router.url.split('?')[0];
    if (previous != null && url.startsWith(`/labs/${previous}`)) {
      this.router.navigateByUrl(url.replace(`/labs/${previous}`, `/labs/${labId}`));
    }
    this.sidebarOpen.set(false);
  }

  protected updateCommandQuery(event: Event): void {
    this.commandQuery.set((event.target as HTMLInputElement).value);
  }

  protected runCommand(route: unknown[]): void {
    this.commandOpen.set(false);
    this.commandQuery.set('');
    this.router.navigate(route as never[]);
  }

  protected setTheme(preference: ThemePreference): void { this.theme.setPreference(preference); }
  protected closeSidebar(): void { this.sidebarOpen.set(false); }

  protected loadNotifications(): void {
    if (!this.authService.isAuthenticated()) return;
    this.announcementsService.getNotifications().subscribe({
      next: list => this.notifications.set(list.slice(0, 10)), error: () => undefined,
    });
  }

  protected openNotification(n: AppNotification): void {
    if (!n.is_read) this.announcementsService.markRead(n.id).subscribe({
      next: () => {
        this.notifications.update(list => list.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        this.unreadCount.update(count => Math.max(0, count - 1));
      }, error: () => undefined,
    });
    if (n.link) this.router.navigateByUrl(n.link);
  }

  protected markAllRead(): void {
    this.announcementsService.markAllRead().subscribe({ next: () => {
      this.notifications.update(list => list.map(x => ({ ...x, is_read: true })));
      this.unreadCount.set(0);
    }});
  }

  protected notificationIcon(type: AppNotificationType): string {
    return ({ member_pending: 'person_add', member_approved: 'check_circle', announcement: 'campaign',
      activity_deadline: 'event' } as Partial<Record<AppNotificationType, string>>)[type] ?? 'notifications';
  }

  protected relativeTime(iso: string): string {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days} d` : new Date(iso).toLocaleDateString('pt-BR');
  }
}
