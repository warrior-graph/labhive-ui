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
          },
        },
        { provide: MemberService, useValue: { getLabMembers: () => of([]) } },
      ],
    }).compileComponents();
  });

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
});
