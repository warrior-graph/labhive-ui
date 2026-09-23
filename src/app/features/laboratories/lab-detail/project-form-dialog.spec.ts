import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ProjectFormDialog } from './project-form-dialog';
import { ProjectService } from '../../../core/services/project.service';
import { ResearchService } from '../../../core/services/research.service';
import { MemberService } from '../../../core/services/member.service';

/**
 * Guards the Material datepicker wiring: the toggle must actually open a
 * calendar. Regressions here are invisible to type-checking (a missing
 * `MatSuffix` import silently renders an inert toggle).
 */
describe('ProjectFormDialog datepickers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectFormDialog],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { labId: 1, project: undefined, research: [], techLeads: [], labs: [] },
        },
        { provide: ProjectService, useValue: { create: () => of({}), update: () => of({}) } },
        { provide: ResearchService, useValue: { getAll: () => of([]) } },
        { provide: MemberService, useValue: { getLabMembers: () => of([]) } },
      ],
    }).compileComponents();
  });

  it('renders a toggle for each date field and opens the calendar', async () => {
    const fixture = TestBed.createComponent(ProjectFormDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll('mat-datepicker-toggle button');
    expect(toggles.length).toBe(2);

    (toggles[0] as HTMLButtonElement).click();
    await fixture.whenStable();

    const calendar = document.querySelector('mat-calendar');
    expect(calendar).toBeTruthy();

    // The suffix directive must be attached, otherwise the toggle is not laid
    // out inside the form field.
    const suffix = fixture.nativeElement.querySelector('.mat-mdc-form-field-icon-suffix');
    expect(suffix).toBeTruthy();
  });
});
