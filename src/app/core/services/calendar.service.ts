import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CalendarFeedInfo } from '../models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Returns (and lazily creates) the personal ICS subscription URL. */
  getFeed(): Observable<CalendarFeedInfo> {
    return this.http.get<CalendarFeedInfo>(`${this.api}/calendar/feed`);
  }

  /** Rotates the feed token, invalidating previously shared URLs. */
  rotateFeed(): Observable<CalendarFeedInfo> {
    return this.http.post<CalendarFeedInfo>(`${this.api}/calendar/feed/rotate`, {});
  }

  /** Downloads a one-off ICS file for the authenticated member. */
  downloadIcs(): Observable<Blob> {
    return this.http.get(`${this.api}/calendar/ics`, { responseType: 'blob' });
  }
}
