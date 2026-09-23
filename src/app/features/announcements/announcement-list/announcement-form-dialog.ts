import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from '@angular/material/datepicker';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { Announcement, LAB_ROLE_LABELS, Laboratory, SessionMode } from '../../../core/models';
import { AnnouncementsService } from '../../../core/services/announcements.service';
import { extractApiError } from '../../../core/utils/api-error';
import { combineDateTime, parseDate, toLocalTime } from '../../../core/utils/date';

export interface AnnouncementFormData { labs: Laboratory[]; announcement: Announcement | null; canManage: boolean; }

@Component({
  selector: 'app-announcement-form-dialog',
  imports: [ReactiveFormsModule, MatButton, MatCheckbox, MatDialogTitle, MatDialogContent,
    MatDialogActions, MatFormField, MatLabel, MatHint, MatError, MatSuffix, MatInput, MatOption,
    MatDatepicker, MatDatepickerInput, MatDatepickerToggle,
    MatProgressSpinner, MatSelect],
  providers: [provideNativeDateAdapter()],
  templateUrl: './announcement-form-dialog.html',
  styles: [`.announcement-form{display:flex;flex-direction:column;gap:4px}.form-error{margin-bottom:8px;padding:8px 12px;border-radius:8px;background:var(--sem-error-bg);color:var(--sem-error-fg)}mat-form-field{width:100%}.date-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.date-row{grid-template-columns:1fr}}`],
})
export class AnnouncementFormDialog {
  readonly dialogRef = inject(MatDialogRef<AnnouncementFormDialog>);
  readonly data = inject<AnnouncementFormData>(MAT_DIALOG_DATA);
  private readonly service = inject(AnnouncementsService);
  private readonly fb = inject(FormBuilder);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = Object.entries(LAB_ROLE_LABELS).map(([value, label]) => ({ value, label }));
  protected readonly modes: {value: SessionMode; label: string}[] = [
    {value:'normal',label:'Normal'}, {value:'quiet',label:'Silêncio'}, {value:'meeting',label:'Reunião'},
    {value:'presentation',label:'Apresentação'}, {value:'recording',label:'Gravação'}, {value:'exam',label:'Prova'},
  ];
  protected readonly form = this.fb.group({
    title: [this.data.announcement?.title ?? '', Validators.required],
    body: [this.data.announcement?.body ?? ''],
    lab_id: [this.data.announcement?.lab_id ?? (null as number | null), Validators.required],
    kind: [this.data.announcement?.kind ?? (this.data.canManage ? 'notice' : 'event')],
    startDate: [parseDate(this.data.announcement?.starts_at)],
    startTime: [this.localTime(this.data.announcement?.starts_at)],
    endDate: [parseDate(this.data.announcement?.ends_at)],
    endTime: [this.localTime(this.data.announcement?.ends_at)],
    session_mode: [this.data.announcement?.session_mode ?? 'normal'],
    audience: [this.data.announcement?.audience ?? ([] as string[])],
    is_pinned: [this.data.announcement?.is_pinned ?? false],
  });
  protected readonly isEvent = computed(() => this.form.controls.kind.value === 'event');
  get isEdit(): boolean { return !!this.data.announcement; }

  protected submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const startsAt = combineDateTime(raw.startDate, raw.startTime);
    const endsAt = combineDateTime(raw.endDate, raw.endTime);
    if (raw.kind === 'event' && (!startsAt || !endsAt || endsAt <= startsAt)) {
      this.error.set('Informe um período válido para o evento.'); return;
    }
    this.loading.set(true); this.error.set(null);
    const payload = {
      title: raw.title ?? '', body: raw.body ?? '', kind: raw.kind as 'notice'|'event',
      starts_at: raw.kind === 'event' && startsAt ? startsAt.toISOString() : undefined,
      ends_at: raw.kind === 'event' && endsAt ? endsAt.toISOString() : undefined,
      session_mode: raw.kind === 'event' ? (raw.session_mode ?? 'normal') : undefined,
      audience: this.data.canManage ? (raw.audience ?? []) : [],
      is_pinned: this.data.canManage && !!raw.is_pinned,
    };
    const request = this.data.announcement
      ? this.service.updateAnnouncement(this.data.announcement.id, payload)
      : this.service.createAnnouncement({ ...payload, lab_id: raw.lab_id! });
    request.subscribe({ next: value => this.dialogRef.close(value), error: (err: HttpErrorResponse) => {
      this.error.set(extractApiError(err, 'Não foi possível salvar.')); this.loading.set(false);
    }});
  }

  private localTime(value?: string | null): string {
    return value ? toLocalTime(parseDate(value)) : '';
  }
}
