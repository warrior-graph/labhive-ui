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
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect, MatSelectChange } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval, startWith, switchMap, takeUntil } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  Floor,
  LabLocation,
  LabRole,
  MANAGER_ROLES,
  Reservation,
  SessionMode,
  Space,
  SpaceType,
} from '../../../core/models';
import { SpaceService } from '../../../core/services/space.service';
import { extractApiError } from '../../../core/utils/api-error';

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
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyed = new Subject<void>();

  protected readonly labId = Number(this.route.snapshot.paramMap.get('labId'));
  protected readonly locations = signal<LabLocation[]>([]);
  protected readonly floors = signal<Floor[]>([]);
  protected readonly spaces = signal<Space[]>([]);
  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly liveSessions = signal<Reservation[]>([]);
  protected readonly selectedLocationId = signal<number | null>(null);
  protected readonly selectedFloor = signal<Floor | null>(null);
  protected readonly selectedSpaceId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  protected readonly selectedSpace = computed(
    () => this.spaces().find((space) => space.id === this.selectedSpaceId()) ?? null,
  );
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

  ngOnInit(): void {
    this.loadLocations();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  protected selectLocation(event: MatSelectChange): void {
    this.selectedLocationId.set(event.value);
    this.selectedFloor.set(null);
    this.spaces.set([]);
    this.loadFloors(event.value);
  }

  protected selectFloor(event: MatSelectChange): void {
    const floor = this.floors().find((item) => item.id === event.value) ?? null;
    this.selectedFloor.set(floor);
    this.selectedSpaceId.set(null);
    if (floor) {
      this.refreshFloor();
      this.watchLiveStatus(floor.id);
    }
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
    this.loading.set(true);
    this.spacesApi
      .getSpaces(this.labId, floor.id, start.toISOString(), end.toISOString())
      .subscribe({
        next: (response) => {
          this.selectedFloor.set(response.floor);
          this.spaces.set(response.spaces);
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
    const booking = this.bookingForm.getRawValue();
    this.saving.set(true);
    this.spacesApi
      .createReservation(this.labId, space.id, {
        starts_at: new Date(availability.startsAt).toISOString(),
        ends_at: new Date(availability.endsAt).toISOString(),
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
      next: () => this.loadReservations(),
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

  protected createSpace(): void {
    const floor = this.selectedFloor();
    if (!floor || this.spaceForm.invalid) return;
    const value = this.spaceForm.getRawValue();
    const offset = this.spaces().length * 18;
    this.spacesApi
      .createSpace(this.labId, floor.id, {
        name: value.name,
        type: value.type,
        capacity: value.capacity,
        width: value.width,
        height: value.height,
        x: 30 + (offset % Math.max(50, floor.layout_width - value.width - 30)),
        y: 30 + (offset % Math.max(50, floor.layout_height - value.height - 30)),
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
          this.refreshFloor();
        },
        error: (error) => this.showError(error, 'Não foi possível criar o espaço.'),
      });
  }

  protected dragStart(event: PointerEvent, space: Space): void {
    if (!this.editing()) return;
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
    if (!this.drag) return;
    const floor = this.selectedFloor();
    const point = this.svgPoint(event);
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
    return space.available ? 'space available' : 'space reserved';
  }

  protected spaceStatus(space: Space): string {
    const live = this.liveSessions().find((item) => item.space_id === space.id);
    if (live) return `${this.modeLabel(live.session_mode)} em andamento`;
    if (!space.is_active) return 'Indisponível';
    return space.available ? 'Disponível' : 'Reservado';
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

  private loadLocations(): void {
    this.spacesApi.getLocations(this.labId).subscribe({
      next: (locations) => {
        this.locations.set(locations);
        this.loading.set(false);
        if (locations.length) {
          this.selectedLocationId.set(locations[0].id);
          this.loadFloors(locations[0].id);
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
      .subscribe({ next: (items) => this.reservations.set(items) });
  }

  private watchLiveStatus(floorId: number): void {
    this.destroyed.next();
    interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() => this.spacesApi.getLiveStatus(this.labId, floorId)),
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
    this.snackBar.open(extractApiError(error, fallback), 'Fechar', { duration: 4500 });
  }
}
