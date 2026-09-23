import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import {
  Floor,
  FloorSpacesResponse,
  LabLocation,
  Reservation,
  SessionMode,
  Space,
  SpaceType,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getSettings(labId: number) {
    return this.http.get<{ max_reservation_hours: number }>(`${this.api}/labs/${labId}/space-settings`);
  }

  updateSettings(labId: number, maxReservationHours: number) {
    return this.http.put<{ max_reservation_hours: number }>(`${this.api}/labs/${labId}/space-settings`, {
      max_reservation_hours: maxReservationHours,
    });
  }

  getLocations(labId: number) {
    return this.http.get<LabLocation[]>(`${this.api}/labs/${labId}/locations`);
  }

  createLocation(labId: number, data: { name: string; address?: string; timezone: string }) {
    return this.http.post<LabLocation>(`${this.api}/labs/${labId}/locations`, data);
  }

  updateLocation(labId: number, locationId: number, data: Partial<LabLocation>) {
    return this.http.put<LabLocation>(`${this.api}/labs/${labId}/locations/${locationId}`, data);
  }

  deleteLocation(labId: number, locationId: number) {
    return this.http.delete<void>(`${this.api}/labs/${labId}/locations/${locationId}`);
  }

  getFloors(labId: number, locationId?: number) {
    const params = locationId ? new HttpParams().set('location_id', locationId) : undefined;
    return this.http.get<Floor[]>(`${this.api}/labs/${labId}/floors`, { params });
  }

  createFloor(labId: number, data: Partial<Floor> & { location_id: number; name: string }) {
    return this.http.post<Floor>(`${this.api}/labs/${labId}/floors`, data);
  }

  updateFloor(labId: number, floorId: number, data: Partial<Floor>) {
    return this.http.put<Floor>(`${this.api}/labs/${labId}/floors/${floorId}`, data);
  }

  deleteFloor(labId: number, floorId: number) {
    return this.http.delete<void>(`${this.api}/labs/${labId}/floors/${floorId}`);
  }

  getSpaces(labId: number, floorId: number, startsAt?: string, endsAt?: string) {
    let params = new HttpParams();
    if (startsAt && endsAt) {
      params = params.set('starts_at', startsAt).set('ends_at', endsAt);
    }
    return this.http.get<FloorSpacesResponse>(
      `${this.api}/labs/${labId}/floors/${floorId}/spaces`,
      { params },
    );
  }

  createSpace(
    labId: number,
    floorId: number,
    data: {
      name: string;
      type: SpaceType;
      capacity: number;
      x: number;
      y: number;
      width: number;
      height: number;
      requires_approval?: boolean;
    },
  ) {
    return this.http.post<Space>(`${this.api}/labs/${labId}/floors/${floorId}/spaces`, data);
  }

  updateSpace(labId: number, spaceId: number, data: Record<string, unknown>) {
    return this.http.put<Space>(`${this.api}/labs/${labId}/spaces/${spaceId}`, data);
  }

  deleteSpace(labId: number, spaceId: number) {
    return this.http.delete<void>(`${this.api}/labs/${labId}/spaces/${spaceId}`);
  }

  duplicateSpace(labId: number, spaceId: number) {
    return this.http.post<Space>(`${this.api}/labs/${labId}/spaces/${spaceId}/duplicate`, {});
  }


  uploadFloorPlan(labId: number, floorId: number, file: File) {
    const body = new FormData(); body.append('file', file);
    return this.http.post<{ layout_image_url: string; layout_version: number }>(
      `${this.api}/labs/${labId}/floors/${floorId}/layout-image`, body,
    );
  }

  getFloorPlan(labId: number, floorId: number) {
    return this.http.get(`${this.api}/labs/${labId}/floors/${floorId}/layout-image`, { responseType: 'blob' });
  }

  assignSchedule(labId: number, spaceId: number, data: {
    member_id: number; valid_from: string; valid_until: string; weekdays: number[];
    starts_at: string; ends_at: string; purpose?: string;
  }) {
    return this.http.post<{ created: number; skipped_past: number; reservations: Reservation[] }>(
      `${this.api}/labs/${labId}/spaces/${spaceId}/assignments`, data,
    );
  }

  createReservation(
    labId: number,
    spaceId: number,
    data: { starts_at: string; ends_at: string; purpose: string; session_mode: SessionMode },
  ) {
    return this.http.post<Reservation>(
      `${this.api}/labs/${labId}/spaces/${spaceId}/reservations`,
      data,
    );
  }

  getReservations(labId: number, startsAt?: string, endsAt?: string) {
    let params = new HttpParams();
    if (startsAt) params = params.set('starts_at', startsAt);
    if (endsAt) params = params.set('ends_at', endsAt);
    return this.http.get<Reservation[]>(`${this.api}/labs/${labId}/reservations`, { params });
  }

  cancelReservation(labId: number, reservationId: number) {
    return this.http.post<Reservation>(
      `${this.api}/labs/${labId}/reservations/${reservationId}/cancel`,
      {},
    );
  }

  checkIn(labId: number, reservationId: number) {
    return this.http.post<Reservation>(
      `${this.api}/labs/${labId}/reservations/${reservationId}/check-in`,
      {},
    );
  }

  checkOut(labId: number, reservationId: number) {
    return this.http.post<Reservation>(
      `${this.api}/labs/${labId}/reservations/${reservationId}/check-out`,
      {},
    );
  }

  getLiveStatus(labId: number, floorId: number) {
    return this.http.get<Reservation[]>(`${this.api}/labs/${labId}/floors/${floorId}/live-status`);
  }
}
