import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type ExportDataset = 'members' | 'activities' | 'projects' | 'attendance';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  download(labId: number, dataset: ExportDataset): void {
    this.http.get(`${this.api}/labs/${labId}/exports/${dataset}.csv`, {
      observe: 'response', responseType: 'blob',
    }).subscribe(response => {
      const disposition = response.headers.get('content-disposition') ?? '';
      const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? `labhive-${dataset}.csv`;
      const url = URL.createObjectURL(response.body!);
      const link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url));
    });
  }
}
