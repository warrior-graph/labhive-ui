import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatBadge } from '@angular/material/badge';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider';
import { MatTooltip } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, interval, startWith, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { AppNotification, AppNotificationType } from '../../../core/models';
import { AnnouncementsService } from '../../../core/services/announcements.service';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    MatToolbar,
    MatButton,
    MatIconButton,
    MatBadge,
    MatIcon,
    MatMenu,
    MatMenuTrigger,
    MatMenuItem,
    MatDivider,
    MatTooltip,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isDark = signal(localStorage.getItem('theme') !== 'light');

  /** Contador de notificações não lidas (badge do sino). */
  protected readonly unreadCount = signal(0);
  /** Últimas 10 notificações exibidas no dropdown. */
  protected readonly notifications = signal<AppNotification[]>([]);

  constructor() {
    this._applyTheme();
    this._initNotificationPolling();
  }

  protected toggleTheme(): void {
    this.isDark.update(v => !v);
    localStorage.setItem('theme', this.isDark() ? 'dark' : 'light');
    this._applyTheme();
  }

  /**
   * Busca o unread-count imediatamente e a cada 60s enquanto o usuário
   * estiver autenticado; zera o badge ao deslogar. Cancelado no destroy.
   */
  private _initNotificationPolling(): void {
    toObservable(this.authService.isAuthenticated)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(authenticated => {
          if (!authenticated) {
            this.unreadCount.set(0);
            this.notifications.set([]);
            return EMPTY;
          }
          return interval(60_000).pipe(
            startWith(0),
            switchMap(() =>
              this.announcementsService.getUnreadCount().pipe(
                // Erro transitório não derruba o polling: a emissão vira EMPTY
                // e o intervalo continua agendando as próximas buscas.
                catchError(() => EMPTY),
              ),
            ),
          );
        }),
      )
      .subscribe(({ count }) => this.unreadCount.set(count));
  }

  /** Recarrega a lista do dropdown (disparado ao abrir o menu). */
  protected loadNotifications(): void {
    if (!this.authService.isAuthenticated()) return;
    this.announcementsService.getNotifications().subscribe({
      next: list => this.notifications.set(list.slice(0, 10)),
      error: () => { /* mantém a lista anterior em erro transitório */ },
    });
    this.announcementsService.getUnreadCount().subscribe({
      next: ({ count }) => this.unreadCount.set(count),
      error: () => { /* mantém o badge anterior em erro transitório */ },
    });
  }

  /** Marca a notificação como lida e navega para o link (se houver). */
  protected openNotification(n: AppNotification): void {
    if (!n.is_read) {
      this.announcementsService.markRead(n.id).subscribe({
        next: () => {
          this.notifications.update(list =>
            list.map(x => (x.id === n.id ? { ...x, is_read: true } : x)),
          );
          this.unreadCount.update(c => Math.max(0, c - 1));
        },
        error: () => { /* segue para o link mesmo se falhar */ },
      });
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  protected markAllRead(): void {
    this.announcementsService.markAllRead().subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(x => ({ ...x, is_read: true })),
        );
        this.unreadCount.set(0);
      },
      error: () => { /* mantém o estado atual em erro */ },
    });
  }

  protected notificationIcon(type: AppNotificationType): string {
    switch (type) {
      case 'member_pending': return 'person_add';
      case 'member_approved': return 'check_circle';
      case 'announcement': return 'campaign';
      case 'activity_deadline': return 'event';
      default: return 'notifications';
    }
  }

  protected relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const minutes = Math.floor((Date.now() - then) / 60_000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return minutes + ' min';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' h';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + ' d';
    return new Date(iso).toLocaleDateString();
  }

  private _applyTheme(): void {
    document.body.classList.toggle('light-theme', !this.isDark());
  }
}
