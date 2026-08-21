import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Announcement, AppNotification } from '../models';

export interface CreateAnnouncementPayload {
  lab_id: number;
  title: string;
  body?: string;
  audience?: string[];
  is_pinned?: boolean;
}

export interface UpdateAnnouncementPayload {
  title?: string;
  body?: string;
  audience?: string[];
  is_pinned?: boolean;
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getAnnouncements(pinnedOnly = false, labId?: number): Observable<Announcement[]> {
    let params = new HttpParams();
    if (pinnedOnly) params = params.set('pinned_only', '1');
    if (labId !== undefined) params = params.set('lab_id', String(labId));
    return this.http.get<Announcement[]>(this.api + '/announcements', { params });
  }

  getAnnouncement(id: number): Observable<Announcement> {
    return this.http.get<Announcement>(this.api + '/announcements/' + id);
  }

  createAnnouncement(data: CreateAnnouncementPayload): Observable<Announcement> {
    return this.http.post<Announcement>(this.api + '/announcements', data);
  }

  updateAnnouncement(
    id: number,
    data: UpdateAnnouncementPayload,
  ): Observable<Announcement> {
    return this.http.put<Announcement>(this.api + '/announcements/' + id, data);
  }

  deleteAnnouncement(id: number): Observable<void> {
    return this.http.delete<void>(this.api + '/announcements/' + id);
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.api + '/notifications');
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      this.api + '/notifications/unread-count',
    );
  }

  markRead(id: number): Observable<AppNotification> {
    return this.http.post<AppNotification>(
      this.api + '/notifications/' + id + '/read',
      {},
    );
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.api + '/notifications/read-all',
      {},
    );
  }
}
