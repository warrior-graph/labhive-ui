import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { FloorPlan } from './floor-plan';
import { AuthService } from '../../../core/auth/auth.service';
import { SpaceService } from '../../../core/services/space.service';
import { MemberService } from '../../../core/services/member.service';

interface Internals {
  availabilityForm: {
    getRawValue(): Record<string, unknown>;
    patchValue(value: Record<string, unknown>): void;
  };
  spaces: { set(value: unknown[]): void };
  occupancy: { set(value: unknown[]): void };
  visibleSpaces(): Array<{ id: number }>;
  applyDuration(start: string, end: string): void;
  setTypeFilter(value: string): void;
  toggleAmenityFilter(key: string): void;
  amenityIcon(key: string): string;
  amenityLabel(key: string): string;
  toggleRecurring(): void;
  recurringOpen(): boolean;
  recurringDates(): string[];
  recurringDayOptions(): Array<{ iso: string }>;
  toggleRecurringDate(iso: string): void;
  selectColleague(membership: unknown): void;
  clearColleague(): void;
  highlightedSpaceIds(): Set<number>;
  colleagueSummary(): string;
  spaceStatus(space: unknown): string;
}

describe('FloorPlan datepickers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloorPlan],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
        },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        {
          provide: SpaceService,
          useValue: {
            getSettings: () => of({ max_reservation_hours: 8 }),
            getLocations: () => of([]),
            getWaitlist: () => of([]),
            getFloors: () => of([]),
            getSpaces: () => of({ floor: { id: 1, layout_width: 1000, layout_height: 700 }, spaces: [] }),
            getReservations: () => of([]),
            getMyReservations: () => of({ upcoming: [], past: [] }),
            getFloorOccupancy: () => of([]),
          },
        },
        { provide: MemberService, useValue: { getLabMembers: () => of([]) } },
      ],
    }).compileComponents();
  });

  function internals(fixture: { componentInstance: unknown }): Internals {
    return fixture.componentInstance as unknown as Internals;
  }

  async function create(): Promise<{ component: Internals; render: () => void }> {
    const fixture = TestBed.createComponent(FloorPlan);
    await fixture.whenStable();
    fixture.detectChanges();
    return { component: internals(fixture), render: () => fixture.detectChanges() };
  }

   it('renders the availability datepickers and opens the calendar', async () => {
     const fixture = TestBed.createComponent(FloorPlan);
     await fixture.whenStable();
     fixture.detectChanges();

     const toggles = fixture.nativeElement.querySelectorAll('mat-datepicker-toggle button');
     expect(toggles.length).toBeGreaterThanOrEqual(2);

     (toggles[0] as HTMLButtonElement).click();
     await fixture.whenStable();
     expect(document.querySelector('mat-calendar')).toBeTruthy();

     expect(fixture.nativeElement.querySelector('.mat-mdc-form-field-icon-suffix')).toBeTruthy();
   });

   it('seeds the date controls with Date objects, not strings', async () => {
     const fixture = TestBed.createComponent(FloorPlan);
     await fixture.whenStable();
     fixture.detectChanges();

     const component = fixture.componentInstance as unknown as {
       availabilityForm: { getRawValue(): Record<string, unknown> };
     };
     const value = component.availabilityForm.getRawValue();
     expect(value['startDate']).toBeInstanceOf(Date);
    expect(value['endDate']).toBeInstanceOf(Date);
  });

  it('applies a duration preset to the availability window', async () => {
    const { component } = await create();
    component.applyDuration('09:00', '12:00');
    const value = component.availabilityForm.getRawValue();
    expect(value['startTime']).toBe('09:00');
    expect(value['endTime']).toBe('12:00');
  });

  it('filters the visible seats by type and amenities', async () => {
    const { component } = await create();
    component.spaces.set([
      { id: 1, type: 'desk', amenities: ['monitor'] },
      { id: 2, type: 'room', amenities: [] },
      { id: 3, type: 'desk', amenities: ['dock'] },
    ]);
    expect(component.visibleSpaces().map((space) => space.id)).toEqual([1, 2, 3]);

    component.setTypeFilter('desk');
    expect(component.visibleSpaces().map((space) => space.id)).toEqual([1, 3]);

    component.toggleAmenityFilter('monitor');
    expect(component.visibleSpaces().map((space) => space.id)).toEqual([1]);
  });

  it('maps known amenities to icons and falls back for unknown keys', async () => {
    const { component } = await create();
    expect(component.amenityIcon('monitor')).toBe('desktop_windows');
    expect(component.amenityIcon('desconhecido')).toBe('check_circle');
    expect(component.amenityLabel('desconhecido')).toBe('desconhecido');
  });

  it('builds recurring day options and toggles the selected days', async () => {
    const { component } = await create();
    expect(component.recurringOpen()).toBe(false);
    component.toggleRecurring();
    expect(component.recurringOpen()).toBe(true);
    expect(component.recurringDates().length).toBe(1);

    const options = component.recurringDayOptions();
    expect(options.length).toBe(14);
    const second = options[1].iso;
    component.toggleRecurringDate(second);
    expect(component.recurringDates()).toContain(second);
    component.toggleRecurringDate(second);
    expect(component.recurringDates()).not.toContain(second);
  });

  it('highlights the seats held by the searched colleague', async () => {
    const { component } = await create();
    component.occupancy.set([{ space_id: 7, organizer_name: 'Ana Souza' }]);
    component.selectColleague({ member_id: 42, member: { first_name: 'Ana', last_name: 'Souza' } });
    expect(component.highlightedSpaceIds().has(7)).toBe(true);
    expect(component.colleagueSummary()).toContain('Ana Souza');
    component.clearColleague();
    expect(component.highlightedSpaceIds().size).toBe(0);
  });

  it('names the occupant of a reserved seat', async () => {
    const { component } = await create();
    component.occupancy.set([{ space_id: 1, organizer_name: 'Ana Souza' }]);
    const seat = { id: 1, name: 'D1', type: 'desk', capacity: 1, is_active: true, available: false, amenities: [] };
    expect(component.spaceStatus(seat)).toBe('Reservado por Ana Souza');
   });
 });
