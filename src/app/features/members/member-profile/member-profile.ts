import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardTitle } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  CalendarFeedInfo,
  LAB_ROLE_LABELS,
  LabMembership,
  LabRole,
  MemberUsage,
  MembershipHistory,
  ROLE_LEVEL,
} from '../../../core/models';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarService } from '../../../core/services/calendar.service';
import { MemberService } from '../../../core/services/member.service';

interface LabReportingInfo {
  labId: number;
  labName: string;
  reportsTo: LabMembership[];
}

@Component({
  selector: 'app-member-profile',
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    MatCard,
    MatCardTitle,
    MatCardContent,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    MatIcon,
    MatProgressSpinner,
  ],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.scss',
})
export class MemberProfile implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly memberService = inject(MemberService);
  private readonly calendarService = inject(CalendarService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly loading = signal(false);
  protected readonly hierarchyLoading = signal(true);
  protected readonly reportingInfo = signal<LabReportingInfo[]>([]);
  protected readonly history = signal<MembershipHistory[]>([]);
  protected readonly historyLoading = signal(true);
  protected readonly usage = signal<MemberUsage | null>(null);
  protected readonly usageLoading = signal(true);
  protected readonly emailNotifications = signal(true);
  protected readonly savingPreference = signal(false);
  protected readonly feed = signal<CalendarFeedInfo | null>(null);
  protected readonly feedLoading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    password: [''],
    lattes_url: [''],
    orcid: [''],
    github_url: [''],
  });

  protected readonly profileLinks = computed(() => {
    const u = this.authService.currentUser();
    return [
      { label: 'Lattes', url: u?.lattes_url ?? null },
      { label: 'ORCID', url: u?.orcid ?? null },
      { label: 'GitHub', url: u?.github_url ?? null },
    ].filter(l => !!l.url);
  });

  protected roleLabel(role: LabRole | string): string {
    return LAB_ROLE_LABELS[role as LabRole] ?? role;
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.form.patchValue({
        first_name: user.first_name,
        last_name: user.last_name,
        lattes_url: user.lattes_url ?? '',
        orcid: user.orcid ?? '',
        github_url: user.github_url ?? '',
      });
      this.emailNotifications.set(user.email_notifications ?? true);
    }

    const memberships = user?.lab_memberships ?? [];
    if (memberships.length === 0) {
      this.hierarchyLoading.set(false);
      return;
    }

    const requests = memberships.map(m =>
      this.memberService.getLabMembers(m.lab_id)
    );

    forkJoin(requests).subscribe({
      next: labMembersArray => {
        const info: LabReportingInfo[] = memberships.map((myMembership, i) => {
          let superiors: LabMembership[];
          if (myMembership.reports_to_id != null) {
            // Explicit assignment: find the assigned person
            const assigned = labMembersArray[i].find(
              m => m.member_id === myMembership.reports_to_id
            );
            superiors = assigned ? [assigned] : [];
          } else {
            // Default inference: all members one role level above
            const myLevel = myMembership.roles?.length
              ? Math.min(...myMembership.roles.map(r => ROLE_LEVEL[r as LabRole] ?? 99))
              : 99;
            superiors = myLevel === 0
              ? []
              : labMembersArray[i].filter(m =>
                  m.member_id !== myMembership.member_id &&
                  (m.roles?.length
                    ? Math.min(...m.roles.map(r => ROLE_LEVEL[r as LabRole] ?? 99))
                    : 99) === myLevel - 1
                );
          }
          return {
            labId: myMembership.lab_id,
            labName: myMembership.laboratory?.name ?? `Laboratório #${myMembership.lab_id}`,
            reportsTo: superiors,
          };
        });
        this.reportingInfo.set(info);
        this.hierarchyLoading.set(false);
      },
      error: () => this.hierarchyLoading.set(false),
    });

    // Membership history
    const userId = user?.id;
    if (userId) {
      this.memberService.getHistory(userId).subscribe({
        next: history => this.history.set(history),
        error: () => this.historyLoading.set(false),
        complete: () => this.historyLoading.set(false),
      });
      this.memberService.getUsage(userId, { limit: 20 }).subscribe({
        next: usage => {
          this.usage.set(usage);
          this.usageLoading.set(false);
        },
        error: () => this.usageLoading.set(false),
      });
    } else {
      this.historyLoading.set(false);
      this.usageLoading.set(false);
    }
  }

  protected toggleEmailNotifications(enabled: boolean): void {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    const previous = this.emailNotifications();
    this.emailNotifications.set(enabled);
    this.savingPreference.set(true);
    this.memberService.updateProfile(userId, { email_notifications: enabled }).subscribe({
      next: updated => {
        this.authService.currentUser.set(updated);
        this.savingPreference.set(false);
        this.snackBar.open(
          enabled ? 'E-mails de notificação ativados.' : 'E-mails de notificação desativados.',
          'Fechar',
          { duration: 2500 },
        );
      },
      error: () => {
        this.emailNotifications.set(previous);
        this.savingPreference.set(false);
        this.snackBar.open('Não foi possível salvar a preferência.', 'Fechar', { duration: 3500 });
      },
    });
  }

  protected loadFeed(): void {
    if (this.feed() || this.feedLoading()) return;
    this.feedLoading.set(true);
    this.calendarService.getFeed().subscribe({
      next: info => {
        this.feed.set(info);
        this.feedLoading.set(false);
      },
      error: () => {
        this.feedLoading.set(false);
        this.snackBar.open('Não foi possível gerar o link do calendário.', 'Fechar', { duration: 3500 });
      },
    });
  }

  protected selectUrl(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected async copyFeedUrl(): Promise<void> {    const url = this.feed()?.webcal_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.snackBar.open('Link do calendário copiado.', 'Fechar', { duration: 2500 });
    } catch {
      this.snackBar.open('Não foi possível copiar automaticamente.', 'Fechar', { duration: 3000 });
    }
  }

  protected rotateFeed(): void {
    this.calendarService.rotateFeed().subscribe({
      next: info => {
        this.feed.set(info);
        this.snackBar.open(
          'Novo link gerado. Assinaturas antigas deixarão de funcionar.',
          'Fechar',
          { duration: 5000 },
        );
      },
      error: () => this.snackBar.open('Não foi possível gerar um novo link.', 'Fechar', { duration: 3500 }),
    });
  }

  protected downloadIcs(): void {
    this.calendarService.downloadIcs().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'labhive.ics';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url));
      },
      error: () => this.snackBar.open('Não foi possível baixar o arquivo.', 'Fechar', { duration: 3500 }),
    });
  }

  protected formatDuration(minutes: number): string {
    const rounded = Math.max(0, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    if (hours === 0) return `${rest} min`;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
  }

  protected attendanceLabel(status: string): string {
    const labels: Record<string, string> = {
      completed: 'Concluída',
      present: 'Presente',
      no_show: 'Ausência',
      scheduled: 'Agendada',
    };
    return labels[status] ?? status;
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    this.loading.set(true);
    const { first_name, last_name, password, lattes_url, orcid, github_url } = this.form.getRawValue();
    const norm = (v: string): string | null => (v?.trim() ? v.trim() : null);
    this.memberService
      .updateProfile(userId, {
        first_name,
        last_name,
        lattes_url: norm(lattes_url),
        orcid: norm(orcid),
        github_url: norm(github_url),
        ...(password && { password }),
      })
      .subscribe({
        next: updated => {
          this.authService.currentUser.set(updated);
          this.form.patchValue({ password: '' });
          this.snackBar.open('Perfil atualizado', 'Fechar', { duration: 2000 });
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.snackBar.open(err.error?.message ?? 'Falha na atualização', 'Fechar', {
            duration: 3000,
          });
          this.loading.set(false);
        },
      });
  }
}
