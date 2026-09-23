import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness.js';

import { environment } from '../../../environments/environment';
import type { PeerPresence } from '../models';
import { AuthService } from '../auth/auth.service';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface OpenFileHandle {
  doc: Y.Doc;
  ytext: Y.Text;
  provider: WebsocketProvider;
  awareness: Awareness;
}

interface StructuralMessage {
  type: 'tree-changed' | 'members-changed' | 'file-deleted' | 'doc-deleted' | 'read-only' | 'hello';
  file_id?: number;
}

@Injectable({ providedIn: 'root' })
export class CollabService {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly httpBackend = inject(HttpBackend);
  private readonly wsUrl = environment.wsUrl;

  readonly status = signal<ConnectionStatus>('disconnected');
  readonly peers = signal<PeerPresence[]>([]);
  readonly structuralEvents = new Subject<StructuralMessage>();

  private structuralWs: WebSocket | null = null;
  private currentFile: OpenFileHandle | null = null;
  private pendingStructuralTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.closeAll());
  }

  private accessToken(): string {
    return localStorage.getItem('access_token') ?? '';
  }

  private makeWsUrl(path: string): string {
    const token = this.accessToken();
    return `${this.wsUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  connectStructural(docId: number): void {
    if (this.structuralWs) {
      this.structuralWs.close();
    }
    const url = this.makeWsUrl(`/doc/${docId}`);
    const ws = new WebSocket(url);
    this.structuralWs = ws;

    ws.onopen = () => {
      this.status.set('connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as StructuralMessage;
        this.debounceStructuralEvent(payload);
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = (event) => {
      this.status.set('disconnected');
      if (event.code === 4401) {
        this.refreshAndReconnect(docId);
      } else if (event.code !== 4000 && event.code !== 4001 && event.code !== 4403) {
        // Reconnect after unexpected close
        setTimeout(() => this.connectStructural(docId), 2_000);
      }
    };

    ws.onerror = () => {
      this.status.set('disconnected');
    };
  }

  private debounceStructuralEvent(payload: StructuralMessage): void {
    if (payload.type === 'tree-changed' || payload.type === 'members-changed') {
      if (this.pendingStructuralTimer) {
        clearTimeout(this.pendingStructuralTimer);
      }
      this.pendingStructuralTimer = setTimeout(() => {
        this.pendingStructuralTimer = null;
        this.structuralEvents.next(payload);
      }, 300);
    } else {
      this.structuralEvents.next(payload);
    }
  }

  openFile(docId: number, fileId: number, initialText?: string): OpenFileHandle {
    this.closeFile();

    const doc = new Y.Doc();
    const ytext = doc.getText('codemirror');
    const provider = new WebsocketProvider(
      this.wsUrl,
      `doc/${docId}/file/${fileId}`,
      doc,
      { params: { token: this.accessToken() } },
    );

    this.status.set('connecting');

    let synced = false;

    provider.on('status', (event: { status: string }) => {
      // eslint-disable-next-line no-console
      console.log(`[collab] status ${event.status} for file ${fileId}`);
      this.status.set(event.status as ConnectionStatus);
    });

    provider.on('sync', (isSynced: boolean) => {
      synced = isSynced;
      // eslint-disable-next-line no-console
      console.log(`[collab] sync ${isSynced} for file ${fileId}; ytext length ${ytext.length}`);
      if (isSynced && ytext.length === 0 && initialText) {
        doc.transact(() => ytext.insert(0, initialText));
      }
    });

    // Fallback: if the WebSocket cannot connect, still populate the editor
    // with the server snapshot after a short grace period.
    setTimeout(() => {
      if (!synced && ytext.length === 0 && initialText) {
        // eslint-disable-next-line no-console
        console.warn(`[collab] sync timeout for file ${fileId}; seeding from text snapshot`);
        doc.transact(() => ytext.insert(0, initialText));
      }
    }, 800);

    const awareness = provider.awareness;
    const member = this.auth.currentUser();
    if (member) {
      awareness.setLocalState({
        user: {
          id: member.id,
          name: `${member.first_name} ${member.last_name}`.trim(),
          color: this.colorForMember(member.id),
        },
      });
    }

    awareness.on('update', () => {
      const states = awareness.getStates();
      const list: PeerPresence[] = [];
      states.forEach((state, clientId) => {
        const user = state?.['user'];
        if (user && clientId !== awareness.clientID) {
          list.push({
            memberId: user['id'] as number,
            name: (user['name'] as string) || 'Unknown',
            color: (user['color'] as string) || '#3b82f6',
            fileId,
          });
        }
      });
      this.peers.set(list);
    });

    const handle = { doc, ytext, provider, awareness };
    this.currentFile = handle;
    return handle;
  }

  closeFile(): void {
    if (this.currentFile) {
      this.currentFile.awareness.setLocalState(null);
      this.currentFile.provider.destroy();
      this.currentFile = null;
      this.peers.set([]);
    }
  }

  closeAll(): void {
    this.closeFile();
    if (this.structuralWs) {
      this.structuralWs.close();
      this.structuralWs = null;
    }
  }

  getCurrentText(): string | null {
    return this.currentFile?.ytext.toString() ?? null;
  }

  updateAwarenessFile(fileId: number): void {
    if (!this.currentFile) return;
    const state = this.currentFile.awareness.getLocalState();
    if (state?.['user']) {
      this.currentFile.awareness.setLocalState({
        ...state,
        user: { ...state['user'], fileId },
      });
    }
  }

  private colorForMember(memberId: number): string {
    const palette = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
    ];
    return palette[memberId % palette.length];
  }

  private refreshAndReconnect(docId: number): void {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.auth.logout();
      return;
    }
    const http = new HttpClient(this.httpBackend);
    firstValueFrom(
      http.post<{ access_token: string }>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } },
      ),
    )
      .then((res) => {
        localStorage.setItem('access_token', res.access_token);
        this.connectStructural(docId);
      })
      .catch(() => this.auth.logout());
  }
}
