import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { Occupancy } from './occupancy';
import { AnalyticsService } from '../../../core/services/analytics.service';

const EMPTY_REPORT = {
  lab_id: 1,
  range: { since: '2025-01-01T00:00:00Z', until: '2025-01-31T00:00:00Z', days: 31 },
  totals: {
    spaces: 0, sessions: 0, attended: 0, no_shows: 0,
    booked_minutes: 0, booked_hours: 0, capacity_minutes: 0, occupancy_rate: 0,
  },
  spaces: [],
  days: [],
};

describe('Occupancy datepickers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Occupancy],
      providers: [
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
        },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
        { provide: AnalyticsService, useValue: { getOccupancy: () => of(EMPTY_REPORT) } },
      ],
    }).compileComponents();
  });

  it('renders period datepickers backed by form controls and opens the calendar', async () => {
    const fixture = TestBed.createComponent(Occupancy);
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-datepicker-toggle button');
    expect(toggles.length).toBe(2);

    const component = fixture.componentInstance as unknown as {
      sinceControl: { value: unknown };
      untilControl: { value: unknown };
    };
    expect(component.sinceControl.value).toBeInstanceOf(Date);
    expect(component.untilControl.value).toBeInstanceOf(Date);

    (toggles[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.querySelector('mat-calendar')).toBeTruthy();

    expect(fixture.nativeElement.querySelector('.mat-mdc-form-field-icon-suffix')).toBeTruthy();
  });
});
