import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { AnnouncementFormDialog } from './announcement-form-dialog';
import { AnnouncementsService } from '../../../core/services/announcements.service';

describe('AnnouncementFormDialog event datepickers', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnouncementFormDialog],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        {
          provide: MAT_DIALOG_DATA,
          // Non-managers default to the `event` kind, which is the branch that
          // renders the start/end date+time fields.
          useValue: { labs: [{ id: 1, name: 'Lab' }], announcement: null, canManage: false },
        },
        {
          provide: AnnouncementsService,
          useValue: { createAnnouncement: () => of({}), updateAnnouncement: () => of({}) },
        },
      ],
    }).compileComponents();
  });

  it('renders date+time fields for an event and opens the calendar', async () => {
    const fixture = TestBed.createComponent(AnnouncementFormDialog);
    fixture.detectChanges();
    await fixture.whenStable();

    // Events expose both start and end pickers.
    const toggles = fixture.nativeElement.querySelectorAll('mat-datepicker-toggle button');
    expect(toggles.length).toBe(2);

    const timeInputs = fixture.nativeElement.querySelectorAll('input[type="time"]');
    expect(timeInputs.length).toBe(2);

    (toggles[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.querySelector('mat-calendar')).toBeTruthy();

    expect(fixture.nativeElement.querySelector('.mat-mdc-form-field-icon-suffix')).toBeTruthy();
  });
});
