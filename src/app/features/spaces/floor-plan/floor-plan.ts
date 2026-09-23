import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect, MatSelectChange } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, catchError, interval, of, startWith, switchMap, takeUntil } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  Floor,
  LabLocation,
  LabMembership,
  LabRole,
  MANAGER_ROLES,
  Reservation,
  SessionMode,
  Space,
  SpaceType,
} from '../../../core/models';
import { SpaceService } from '../../../core/services/space.service';
import { MemberService } from '../../../core/services/member.service';
import { extractApiError } from '../../../core/utils/api-error';
import { NameEditDialog, NameEditDialogData } from './name-edit-dialog';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-floor-plan',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    MatOption,
    MatProgressSpinner,
    MatSelect,
  ],
  templateUrl: './floor-plan.html',
  styleUrl: './floor-plan.scss',
})
export class FloorPlan implements OnInit, OnDestroy {
  @ViewChild('floorSvg') private floorSvg?: ElementRef<SVGSVGElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly spacesApi = inject(SpaceService);
  private readonly membersApi = inject(MemberService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyed = new Subject<void>();

  protected readonly labId = Number(this.route.snapshot.paramMap.get('labId'));
  protected readonly locations = signal<LabLocation[]>([]);
  protected readonly floors = signal<Floor[]>([]);
  protected readonly spaces = signal<Space[]>([]);
  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly liveSessions = signal<Reservation[]>([]);
  protected readonly members = signal<LabMembership[]>([]);
  protected readonly floorImageUrl = signal<string | null>(null);
  protected readonly selectedLocationId = signal<number | null>(null);
  protected readonly selectedFloor = signal<Floor | null>(null);
  protected readonly selectedSpaceId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly deletingSpace = signal(false);
  protected readonly zoom = signal(1);
  protected readonly maxReservationHours = signal(8);
  protected readonly drawMode = signal(false);
  protected readonly draftRect = signal<{ x: number; y: number; width: number; height: number } | null>(null);

  protected readonly selectedSpace = computed(
    () => this.spaces().find((space) => space.id === this.selectedSpaceId()) ?? null,
  );
  protected readonly selectedLocation = computed(
    () => this.locations().find((location) => location.id === this.selectedLocationId()) ?? null,
  );
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  protected readonly isManager = computed(() => {
    const user = this.auth.currentUser();
    if (user?.is_super_admin) return true;
    const membership = user?.lab_memberships?.find((item) => item.lab_id === this.labId);
    return membership?.roles?.some((role) => MANAGER_ROLES.includes(role as LabRole)) ?? false;
  });

  protected readonly availabilityForm = this.fb.nonNullable.group({
    startsAt: [this.localDateTime(new Date(Date.now() + 60 * 60 * 1000)), Validators.required],
    endsAt: [this.localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)), Validators.required],
  });
  protected readonly bookingForm = this.fb.nonNullable.group({
    purpose: ['', [Validators.required, Validators.maxLength(256)]],
    sessionMode: ['normal' as SessionMode, Validators.required],
  });
  protected readonly locationForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    address: [''],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', Validators.required],
  });
  protected readonly floorForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    level: [0],
  });
  protected readonly assignmentForm = this.fb.nonNullable.group({
    memberId: [null as number | null, Validators.required],
    validFrom: [new Date().toISOString().slice(0, 10), Validators.required],
    validUntil: [new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10), Validators.required],
    startsAt: ['08:00', Validators.required],
    endsAt: ['17:00', Validators.required],
    weekdays: [[0, 1, 2, 3, 4] as number[], Validators.required],
  });

  protected readonly settingsForm = this.fb.nonNullable.group({
    maxReservationHours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
  });

  protected readonly spaceForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['desk' as SpaceType, Validators.required],
    capacity: [1, [Validators.required, Validators.min(1)]],
    width: [120, [Validators.required, Validators.min(20)]],
    height: [80, [Validators.required, Validators.min(20)]],
    requiresApproval: [false],
  });

  protected readonly spaceTypes: { value: SpaceType; label: string }[] = [
    { value: 'room', label: 'Sala' },
    { value: 'desk', label: 'Mesa' },
    { value: 'workstation', label: 'Estação de trabalho' },
    { value: 'bench', label: 'Bancada' },
    { value: 'shared_area', label: 'Área compartilhada' },
  ];
  protected readonly sessionModes: { value: SessionMode; label: string }[] = [
    { value: 'normal', label: 'Uso normal' },
    { value: 'quiet', label: 'Sessão silenciosa' },
    { value: 'meeting', label: 'Reunião' },
    { value: 'presentation', label: 'Apresentação' },
    { value: 'recording', label: 'Gravação' },
    { value: 'exam', label: 'Prova' },
  ];

  private drag: { id: number; offsetX: number; offsetY: number } | null = null;
  private drawingStart: { x: number; y: number } | null = null;

  ngOnInit(): void {
    this.loadSettings();
    this.loadLocations();
    if (this.isManager()) this.membersApi.getLabMembers(this.labId).subscribe(items => this.members.set(items));
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    const image = this.floorImageUrl(); if (image) URL.revokeObjectURL(image);
  }

  protected selectLocation(event: MatSelectChange): void {
    this.selectedLocationId.set(event.value);
    this.selectedFloor.set(null);
    this.zoom.set(1);
    this.spaces.set([]);
    this.loadFloors(event.value);
  }

  protected selectSpaceFromList(event: MatSelectChange): void {
    const space = this.spaces().find((item) => item.id === event.value);
    if (space) this.selectSpace(space);
  }

  protected selectFloor(event: MatSelectChange): void {
    const floor = this.floors().find((item) => item.id === event.value) ?? null;
    this.selectedFloor.set(floor);
    this.selectedSpaceId.set(null);
    this.zoom.set(1);
    if (floor) {
      this.refreshFloor();
      this.watchLiveStatus(floor.id);
    }
  }

  protected renameLocation(): void {
    const location = this.selectedLocation();
    if (!location) return;
    const ref = this.dialog.open<NameEditDialog, NameEditDialogData, string>(NameEditDialog, {
      data: { title: 'Renomear local', label: 'Nome do local', value: location.name },
      width: '420px',
    });
    ref.afterClosed().subscribe((name) => {
      if (!name || name === location.name) return;
      this.spacesApi.updateLocation(this.labId, location.id, { name }).subscribe({
        next: (updated) => {
          this.locations.update((items) => items.map((item) => item.id === updated.id ? updated : item));
          this.snackBar.open('Local atualizado.', 'Fechar', { duration: 2500 });
        },
        error: (error) => this.showError(error, 'Não foi possível atualizar o local.'),
      });
    });
  }

  protected deleteLocation(): void {
    const location = this.selectedLocation();
    if (!location) return;
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir local', message: `Excluir “${location.name}”? Remova os andares primeiro.`, confirmLabel: 'Excluir local' },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.spacesApi.deleteLocation(this.labId, location.id).subscribe({
        next: () => {
          this.selectedLocationId.set(null); this.selectedFloor.set(null); this.floors.set([]); this.spaces.set([]);
          this.snackBar.open('Local excluído.', 'Fechar', { duration: 2500 });
          this.loadLocations();
        },
        error: (error) => this.showError(error, 'Não foi possível excluir. Remova os andares deste local primeiro.'),
      });
    });
  }

  protected renameFloor(): void {
    const floor = this.selectedFloor();
    if (!floor) return;
    const ref = this.dialog.open<NameEditDialog, NameEditDialogData, string>(NameEditDialog, {
      data: { title: 'Renomear andar', label: 'Nome do andar', value: floor.name },
      width: '420px',
    });
    ref.afterClosed().subscribe((name) => {
      if (!name || name === floor.name) return;
      this.spacesApi.updateFloor(this.labId, floor.id, { name }).subscribe({
        next: (updated) => {
          this.floors.update((items) => items.map((item) => item.id === updated.id ? updated : item));
          this.selectedFloor.set(updated);
          this.snackBar.open('Andar atualizado.', 'Fechar', { duration: 2500 });
        },
        error: (error) => this.showError(error, 'Não foi possível atualizar o andar.'),
      });
    });
  }

  protected blurSpaceName(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }

  protected saveSpaceName(space: Space, event: Event): void {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim();
    if (!name) {
      input.value = space.name;
      this.snackBar.open('O nome do espaço é obrigatório.', 'Fechar', { duration: 3000 });
      return;
    }
    if (name === space.name) return;
    this.spacesApi.updateSpace(this.labId, space.id, { name }).subscribe({
      next: (updated) => {
        this.spaces.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.snackBar.open('Nome atualizado.', 'Fechar', { duration: 2200 });
      },
      error: (error) => {
        input.value = space.name;
        this.showError(error, 'Não foi possível atualizar o nome.');
      },
    });
  }

  protected changeZoom(delta: number): void {
    this.zoom.update((value) => Math.min(3, Math.max(1, Number((value + delta).toFixed(2)))));
  }

  protected resetZoom(): void {
    this.zoom.set(1);
  }

  protected zoomWithWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.changeZoom(event.deltaY < 0 ? 0.15 : -0.15);
  }

  protected deleteFloor(): void {
    const floor = this.selectedFloor();
    const location = this.selectedLocation();
    if (!floor || !location) return;
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: { title: 'Excluir andar', message: `Excluir “${floor.name}”? Remova as regiões primeiro.`, confirmLabel: 'Excluir andar' },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.spacesApi.deleteFloor(this.labId, floor.id).subscribe({
        next: () => {
          this.selectedFloor.set(null); this.spaces.set([]);
          this.snackBar.open('Andar excluído.', 'Fechar', { duration: 2500 });
          this.loadFloors(location.id);
        },
        error: (error) => this.showError(error, 'Não foi possível excluir. Remova as regiões deste andar primeiro.'),
      });
    });
  }

  protected refreshFloor(): void {
    const floor = this.selectedFloor();
    if (!floor || this.availabilityForm.invalid) return;
    const { startsAt, endsAt } = this.availabilityForm.getRawValue();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      this.snackBar.open('O horário final deve ser posterior ao inicial.', 'Fechar', {
        duration: 3500,
      });
      return;
    }
    if (end.getTime() - start.getTime() > this.maxReservationHours() * 60 * 60 * 1000) {
      this.snackBar.open(`A reserva pode durar no máximo ${this.maxReservationHours()} hora(s).`, 'Fechar', { duration: 4000 });
      return;
    }
    this.loading.set(true);
    this.spacesApi
      .getSpaces(this.labId, floor.id, start.toISOString(), end.toISOString())
      .subscribe({
        next: (response) => {
          this.selectedFloor.set(response.floor);
          this.spaces.set(response.spaces);
          this.loadFloorImage(response.floor);
          this.loading.set(false);
        },
        error: (error) => this.showError(error, 'Falha ao carregar o mapa.'),
      });
    this.loadReservations();
  }

  protected selectSpace(space: Space): void {
    if (!this.editing()) this.selectedSpaceId.set(space.id);
  }

  protected reserve(): void {
    const space = this.selectedSpace();
    if (!space?.available || this.bookingForm.invalid) return;
    const availability = this.availabilityForm.getRawValue();
    const start = new Date(availability.startsAt);
    const end = new Date(availability.endsAt);
    if (end <= start || end.getTime() - start.getTime() > this.maxReservationHours() * 60 * 60 * 1000) {
      this.snackBar.open(`A reserva deve durar no máximo ${this.maxReservationHours()} hora(s).`, 'Fechar', { duration: 4000 });
      return;
    }
    const booking = this.bookingForm.getRawValue();
    this.saving.set(true);
    this.spacesApi
      .createReservation(this.labId, space.id, {
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        purpose: booking.purpose,
        session_mode: booking.sessionMode,
      })
      .subscribe({
        next: (reservation) => {
          this.saving.set(false);
          this.bookingForm.reset({ purpose: '', sessionMode: 'normal' });
          this.selectedSpaceId.set(null);
          this.snackBar.open(
            reservation.status === 'pending'
              ? 'Reserva enviada para aprovação.'
              : 'Espaço reservado.',
            'Fechar',
            { duration: 3500 },
          );
          this.refreshFloor();
        },
        error: (error) => this.showError(error, 'Não foi possível criar a reserva.'),
      });
  }

  protected cancel(reservation: Reservation): void {
    this.spacesApi.cancelReservation(this.labId, reservation.id).subscribe({
      next: () => {
        this.loadReservations();
        this.refreshFloor();
      },
      error: (error) => this.showError(error, 'Não foi possível cancelar a reserva.'),
    });
  }

  protected checkIn(reservation: Reservation): void {
    this.spacesApi.checkIn(this.labId, reservation.id).subscribe({
      next: (checkedIn) => {
        this.loadReservations();
        this.refreshFloor();
        const warning = checkedIn.warnings?.find(item => item.code === 'space_preallocated');
        this.snackBar.open(
          warning?.message ?? 'Check-in registrado.',
          'Entendi',
          { duration: warning ? 9000 : 3000 },
        );
      },
      error: (error) => this.showError(error, 'Não foi possível fazer check-in.'),
    });
  }

  protected checkOut(reservation: Reservation): void {
    this.spacesApi.checkOut(this.labId, reservation.id).subscribe({
      next: () => {
        this.loadReservations();
        this.refreshFloor();
      },
      error: (error) => this.showError(error, 'Não foi possível fazer check-out.'),
    });
  }

  protected saveSettings(): void {
    if (this.settingsForm.invalid) return;
    const hours = this.settingsForm.getRawValue().maxReservationHours;
    this.spacesApi.updateSettings(this.labId, hours).subscribe({
      next: (settings) => {
        this.maxReservationHours.set(settings.max_reservation_hours);
        this.settingsForm.setValue({ maxReservationHours: settings.max_reservation_hours });
        this.snackBar.open('Política de reservas atualizada.', 'Fechar', { duration: 2500 });
      },
      error: (error) => this.showError(error, 'Não foi possível atualizar o limite de reserva.'),
    });
  }

  protected createLocation(): void {
    if (this.locationForm.invalid) return;
    this.spacesApi.createLocation(this.labId, this.locationForm.getRawValue()).subscribe({
      next: (location) => {
        this.locations.update((items) => [...items, location]);
        this.selectedLocationId.set(location.id);
        this.locationForm.reset({ name: '', address: '', timezone: location.timezone });
        this.loadFloors(location.id);
      },
      error: (error) => this.showError(error, 'Não foi possível criar o local.'),
    });
  }

  protected createFloor(): void {
    const locationId = this.selectedLocationId();
    if (!locationId || this.floorForm.invalid) return;
    const value = this.floorForm.getRawValue();
    this.spacesApi
      .createFloor(this.labId, { location_id: locationId, name: value.name, level: value.level })
      .subscribe({
        next: (floor) => {
          this.floors.update((items) => [...items, floor]);
          this.selectedFloor.set(floor);
          this.floorForm.reset({ name: '', level: 0 });
          this.refreshFloor();
        },
        error: (error) => this.showError(error, 'Não foi possível criar o andar.'),
      });
  }

  protected uploadFloorPlan(event: Event): void {
    const floor = this.selectedFloor();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!floor || !file) return;
    this.uploading.set(true);
    this.spacesApi.uploadFloorPlan(this.labId, floor.id, file).subscribe({
      next: () => { this.uploading.set(false); this.refreshFloor(); this.snackBar.open('Planta atualizada.', 'Fechar', {duration: 2500}); },
      error: error => this.showError(error, 'Não foi possível enviar a planta.'),
    });
  }

  protected assignSchedule(): void {
    const space = this.selectedSpace(); const value = this.assignmentForm.getRawValue();
    if (!space || this.assignmentForm.invalid || value.memberId == null) return;
    this.saving.set(true);
    this.spacesApi.assignSchedule(this.labId, space.id, {
      member_id: value.memberId, valid_from: value.validFrom, valid_until: value.validUntil,
      starts_at: value.startsAt, ends_at: value.endsAt, weekdays: value.weekdays,
    }).subscribe({
      next: result => {
        this.saving.set(false);
        const skipped = result.skipped_past
          ? ` ${result.skipped_past} ocorrência(s) passada(s) foram ignoradas.`
          : '';
        this.snackBar.open(
          `${result.created} horários pré-alocados.${skipped}`,
          'Fechar',
          { duration: 5000 },
        );
        this.refreshFloor();
      },
      error: error => this.showError(error, 'Não foi possível atribuir os horários.'),
    });
  }

  protected canCheckIn(reservation: Reservation): boolean {
    const now = Date.now();
    return reservation.status === 'confirmed' && !reservation.checked_in_at &&
      now >= new Date(reservation.check_in_opens_at).getTime() &&
      now <= new Date(reservation.check_in_closes_at).getTime();
  }

  protected duplicateSpace(space: Space): void {
    this.saving.set(true);
    this.spacesApi.duplicateSpace(this.labId, space.id).subscribe({
      next: (duplicate) => {
        this.saving.set(false);
        this.snackBar.open(`“${duplicate.name}” foi criado.`, 'Fechar', { duration: 3000 });
        this.refreshFloor();
        this.selectedSpaceId.set(duplicate.id);
      },
      error: (error) => this.showError(error, 'Não foi possível duplicar o espaço.'),
    });
  }

  protected toggleSpaceLock(space: Space): void {
    this.saving.set(true);
    this.spacesApi.updateSpace(this.labId, space.id, { is_locked: !space.is_locked }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.spaces.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.snackBar.open(updated.is_locked ? 'Espaço fixado.' : 'Espaço liberado para mover.', 'Fechar', { duration: 2500 });
      },
      error: (error) => this.showError(error, 'Não foi possível alterar a fixação.'),
    });
  }

  protected deleteSpace(space: Space): void {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Excluir espaço',
        message: `Excluir “${space.name}” do mapa? Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir espaço',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.deletingSpace.set(true);
      this.spacesApi.deleteSpace(this.labId, space.id).subscribe({
        next: () => {
          this.deletingSpace.set(false);
          this.selectedSpaceId.set(null);
          this.snackBar.open('Espaço excluído.', 'Fechar', { duration: 3000 });
          this.refreshFloor();
        },
        error: (error) => {
          this.deletingSpace.set(false);
          this.showError(
            error,
            'Não foi possível excluir. Espaços com reservas devem ser desativados para preservar o histórico.',
          );
        },
      });
    });
  }

  protected createSpace(): void {
    const floor = this.selectedFloor();
    if (!floor || this.spaceForm.invalid) return;
    const value = this.spaceForm.getRawValue();
    const draft = this.draftRect();
    if (!draft) {
      this.snackBar.open('Desenhe o retângulo do espaço na planta primeiro.', 'Fechar', { duration: 3500 });
      return;
    }
    this.spacesApi
      .createSpace(this.labId, floor.id, {
        name: value.name,
        type: value.type,
        capacity: value.capacity,
        width: draft.width,
        height: draft.height,
        x: draft.x,
        y: draft.y,
        requires_approval: value.requiresApproval,
      })
      .subscribe({
        next: () => {
          this.spaceForm.reset({
            name: '',
            type: 'desk',
            capacity: 1,
            width: 120,
            height: 80,
            requiresApproval: false,
          });
          this.draftRect.set(null);
          this.drawMode.set(false);
          this.refreshFloor();
        },
        error: (error) => this.showError(error, 'Não foi possível criar o espaço.'),
      });
  }

  protected toggleDrawMode(): void {
    const active = !this.drawMode();
    this.drawMode.set(active);
    this.draftRect.set(null);
    this.drawingStart = null;
  }

  protected floorPointerDown(event: PointerEvent): void {
    if (!this.editing() || !this.drawMode()) return;
    const target = event.target as Element;
    if (target.closest('.space')) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.svgPoint(event);
    this.drawingStart = point;
    this.draftRect.set({ x: point.x, y: point.y, width: 0, height: 0 });
    this.floorSvg?.nativeElement.setPointerCapture(event.pointerId);
  }

  protected dragStart(event: PointerEvent, space: Space): void {
    if (!this.editing() || space.is_locked) return;
    event.preventDefault();
    const point = this.svgPoint(event);
    this.drag = {
      id: space.id,
      offsetX: point.x - space.layout.x,
      offsetY: point.y - space.layout.y,
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  protected dragMove(event: PointerEvent): void {
    const floor = this.selectedFloor();
    const point = this.svgPoint(event);
    if (this.drawingStart && floor) {
      const x = Math.max(0, Math.min(this.drawingStart.x, point.x));
      const y = Math.max(0, Math.min(this.drawingStart.y, point.y));
      const maxX = Math.min(floor.layout_width, Math.max(this.drawingStart.x, point.x));
      const maxY = Math.min(floor.layout_height, Math.max(this.drawingStart.y, point.y));
      this.draftRect.set({ x, y, width: maxX - x, height: maxY - y });
      return;
    }
    if (!this.drag) return;
    this.spaces.update((items) =>
      items.map((space) => {
        if (space.id !== this.drag?.id || !floor) return space;
        const x = Math.max(
          0,
          Math.min(floor.layout_width - space.layout.width, point.x - this.drag.offsetX),
        );
        const y = Math.max(
          0,
          Math.min(floor.layout_height - space.layout.height, point.y - this.drag.offsetY),
        );
        return { ...space, layout: { ...space.layout, x, y } };
      }),
    );
  }

  protected dragEnd(): void {
    if (this.drawingStart) {
      this.drawingStart = null;
      const draft = this.draftRect();
      if (!draft || draft.width < 20 || draft.height < 20) {
        this.draftRect.set(null);
        this.snackBar.open('Desenhe um retângulo de pelo menos 20 × 20.', 'Fechar', { duration: 3000 });
      } else {
        this.spaceForm.patchValue({
          width: Math.round(draft.width),
          height: Math.round(draft.height),
        });
      }
      return;
    }
    if (!this.drag) return;
    const moved = this.spaces().find((space) => space.id === this.drag?.id);
    this.drag = null;
    if (!moved) return;
    this.spacesApi
      .updateSpace(this.labId, moved.id, { x: moved.layout.x, y: moved.layout.y })
      .subscribe({
        error: (error) => {
          this.showError(error, 'Não foi possível salvar a posição.');
          this.refreshFloor();
        },
      });
  }

  protected spaceClass(space: Space): string {
    if (!space.is_active) return 'space unavailable';
    if (this.liveSessions().some((item) => item.space_id === space.id)) return 'space live';
    if (!space.available) return 'space reserved';
    if (space.preallocation) return 'space preallocated';
    return 'space available';
  }

  protected spaceStatus(space: Space): string {
    const live = this.liveSessions().find((item) => item.space_id === space.id);
    if (live) return `${this.modeLabel(live.session_mode)} em andamento`;
    if (!space.is_active) return 'Indisponível';
    if (!space.available) return 'Reservado';
    if (space.preallocation) return `Pré-alocado para ${space.preallocation.member_name}`;
    return 'Disponível';
  }

  protected spaceName(id: number): string {
    return this.spaces().find((space) => space.id === id)?.name ?? `Espaço ${id}`;
  }

  protected modeLabel(mode: SessionMode): string {
    return this.sessionModes.find((item) => item.value === mode)?.label ?? mode;
  }

  protected canAct(reservation: Reservation): boolean {
    return reservation.status === 'confirmed' || reservation.status === 'pending';
  }

  private loadFloorImage(floor: Floor): void {
    const previous = this.floorImageUrl(); if (previous) URL.revokeObjectURL(previous);
    this.floorImageUrl.set(null);
    if (!floor.layout_image_url) return;
    this.spacesApi.getFloorPlan(this.labId, floor.id).subscribe({
      next: (blob) => {
        if (this.selectedFloor()?.id === floor.id) {
          this.floorImageUrl.set(URL.createObjectURL(blob));
        }
      },
      error: (error) => this.showError(error, 'Não foi possível carregar a imagem da planta.'),
    });
  }

  private loadSettings(): void {
    this.spacesApi.getSettings(this.labId).subscribe({
      next: (settings) => {
        this.maxReservationHours.set(settings.max_reservation_hours);
        this.settingsForm.setValue({ maxReservationHours: settings.max_reservation_hours });
      },
      error: (error) => this.showError(error, 'Falha ao carregar a política de reservas.'),
    });
  }

  private loadLocations(): void {
    this.spacesApi.getLocations(this.labId).subscribe({
      next: (locations) => {
        this.locations.set(locations);
        this.loading.set(false);
        if (locations.length) {
          this.selectedLocationId.set(locations[0].id);
          this.loadFloors(locations[0].id);
        } else {
          this.selectedLocationId.set(null);
          this.selectedFloor.set(null);
          this.floors.set([]);
          this.spaces.set([]);
        }
      },
      error: (error) => this.showError(error, 'Falha ao carregar os locais.'),
    });
  }

  private loadFloors(locationId: number): void {
    this.spacesApi.getFloors(this.labId, locationId).subscribe({
      next: (floors) => {
        this.floors.set(floors);
        if (floors.length) {
          this.selectedFloor.set(floors[0]);
          this.refreshFloor();
          this.watchLiveStatus(floors[0].id);
        } else {
          this.selectedFloor.set(null);
          this.spaces.set([]);
          this.reservations.set([]);
        }
      },
      error: (error) => this.showError(error, 'Falha ao carregar os andares.'),
    });
  }

  private loadReservations(): void {
    const values = this.availabilityForm.getRawValue();
    this.spacesApi
      .getReservations(
        this.labId,
        new Date(values.startsAt).toISOString(),
        new Date(values.endsAt).toISOString(),
      )
      .subscribe({
        next: (items) => this.reservations.set(items),
        error: (error) => this.showError(error, 'Não foi possível carregar as reservas.'),
      });
  }

  private watchLiveStatus(floorId: number): void {
    this.destroyed.next();
    interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() => this.spacesApi.getLiveStatus(this.labId, floorId).pipe(
          catchError(() => of([] as Reservation[])),
        )),
        takeUntil(this.destroyed),
      )
      .subscribe({ next: (sessions) => this.liveSessions.set(sessions) });
  }

  private svgPoint(event: PointerEvent): { x: number; y: number } {
    const svg = this.floorSvg?.nativeElement;
    const floor = this.selectedFloor();
    if (!svg || !floor) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * floor.layout_width,
      y: ((event.clientY - rect.top) / rect.height) * floor.layout_height,
    };
  }

  private localDateTime(date: Date): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private showError(error: HttpErrorResponse, fallback: string): void {
    this.loading.set(false);
    this.saving.set(false);
    this.uploading.set(false);
    this.snackBar.open(extractApiError(error, fallback), 'Fechar', { duration: 4500 });
  }
}
