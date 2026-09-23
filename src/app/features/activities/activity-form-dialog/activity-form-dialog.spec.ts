import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ActivityFormDialog } from './activity-form-dialog';
import { DashboardService } from '../../../core/services/dashboard.service';
import { MemberService } from '../../../core/services/member.service';

describe('ActivityFormDialog deadline datepicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityFormDialog],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: { labId: 1, activity: null, labs: [] } },
        { provide: DashboardService, useValue: { createActivity: () => of({}), updateActivity: () => of({}) } },
        { provide: MemberService, useValue: { getLabMembers: () => of([]) } },
      ],
    }).compileComponents();
  });

  it('renders the deadline toggle and opens the calendar', async () => {
    const fixture = TestBed.createComponent(ActivityFormDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-datepicker-toggle button');
    expect(toggles.length).toBe(1);

    (toggles[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.querySelector('mat-calendar')).toBeTruthy();

    expect(fixture.nativeElement.querySelector('.mat-mdc-form-field-icon-suffix')).toBeTruthy();
  });
});
