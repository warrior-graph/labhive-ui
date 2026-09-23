import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CompileError,
  CompileJob,
  DocumentFileNode,
  DocumentMemberEntry,
  DocumentRole,
  LabDocument,
} from '../models';

export interface CreateDocumentPayload {
  name: string;
  project_id?: number | null;
  template?: 'blank' | 'article';
}

export interface CreateFilePayload {
  parent_id: number | null;
  name: string;
  kind: 'folder' | 'file';
  content?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(labId: number): Observable<LabDocument[]> {
    return this.http.get<LabDocument[]>(`${this.api}/labs/${labId}/documents`);
  }

  create(labId: number, data: CreateDocumentPayload): Observable<LabDocument> {
    return this.http.post<LabDocument>(`${this.api}/labs/${labId}/documents`, data);
  }

  get(labId: number, docId: number): Observable<LabDocument> {
    return this.http.get<LabDocument>(`${this.api}/labs/${labId}/documents/${docId}`);
  }

  rename(labId: number, docId: number, name: string): Observable<LabDocument> {
    return this.http.patch<LabDocument>(`${this.api}/labs/${labId}/documents/${docId}`, { name });
  }

  remove(labId: number, docId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/labs/${labId}/documents/${docId}`);
  }

  getFiles(labId: number, docId: number): Observable<DocumentFileNode[]> {
    return this.http.get<DocumentFileNode[]>(`${this.api}/labs/${labId}/documents/${docId}/files`);
  }

  createFile(labId: number, docId: number, data: CreateFilePayload): Observable<DocumentFileNode> {
    return this.http.post<DocumentFileNode>(`${this.api}/labs/${labId}/documents/${docId}/files`, data);
  }

  updateFile(
    labId: number,
    docId: number,
    fileId: number,
    data: { name?: string; parent_id?: number | null },
  ): Observable<DocumentFileNode> {
    return this.http.patch<DocumentFileNode>(
      `${this.api}/labs/${labId}/documents/${docId}/files/${fileId}`,
      data,
    );
  }

  saveFileContent(
    labId: number,
    docId: number,
    fileId: number,
    content: string,
  ): Observable<DocumentFileNode> {
    return this.http.patch<DocumentFileNode>(
      `${this.api}/labs/${labId}/documents/${docId}/files/${fileId}/content`,
      { content },
    );
  }

  deleteFile(labId: number, docId: number, fileId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/labs/${labId}/documents/${docId}/files/${fileId}`);
  }

  getFileContent(labId: number, docId: number, fileId: number): Observable<{ text_content: string }> {
    return this.http.get<{ text_content: string }>(
      `${this.api}/labs/${labId}/documents/${docId}/files/${fileId}/content`,
    );
  }

  uploadFile(labId: number, docId: number, parentId: number | null, file: File): Observable<DocumentFileNode> {
    const form = new FormData();
    form.append('file', file);
    if (parentId !== null) {
      form.append('parent_id', String(parentId));
    }
    return this.http.post<DocumentFileNode>(
      `${this.api}/labs/${labId}/documents/${docId}/files/upload`,
      form,
    );
  }

  downloadFileUrl(labId: number, docId: number, fileId: number): string {
    return `${this.api}/labs/${labId}/documents/${docId}/files/${fileId}/download`;
  }

  listMembers(labId: number, docId: number): Observable<DocumentMemberEntry[]> {
    return this.http.get<DocumentMemberEntry[]>(
      `${this.api}/labs/${labId}/documents/${docId}/members`,
    );
  }

  addMember(labId: number, docId: number, memberId: number, role: Exclude<DocumentRole, 'owner'>): Observable<DocumentMemberEntry> {
    return this.http.post<DocumentMemberEntry>(
      `${this.api}/labs/${labId}/documents/${docId}/members`,
      { member_id: memberId, role },
    );
  }

  updateMemberRole(
    labId: number,
    docId: number,
    memberId: number,
    role: Exclude<DocumentRole, 'owner'>,
  ): Observable<DocumentMemberEntry> {
    return this.http.patch<DocumentMemberEntry>(
      `${this.api}/labs/${labId}/documents/${docId}/members/${memberId}`,
      { role },
    );
  }

  removeMember(labId: number, docId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/labs/${labId}/documents/${docId}/members/${memberId}`);
  }

  compile(labId: number, docId: number): Observable<CompileJob> {
    return this.http.post<CompileJob>(`${this.api}/labs/${labId}/documents/${docId}/compile`, {});
  }

  getCompileJob(labId: number, docId: number, jobId: number): Observable<CompileJob> {
    return this.http.get<CompileJob>(
      `${this.api}/labs/${labId}/documents/${docId}/compile-jobs/${jobId}`,
    );
  }

  pdfUrl(labId: number, docId: number): string {
    return `${this.api}/labs/${labId}/documents/${docId}/pdf`;
  }
}
