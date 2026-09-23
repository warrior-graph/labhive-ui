import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-pdf-preview',
  imports: [],
  template: `
    <div class="pdf-preview">
      @if (url()) {
        <iframe [src]="url()" title="PDF preview"></iframe>
      } @else if (error()) {
        <div class="pdf-placeholder">
          <span>Erro ao carregar o PDF. Tente recompilar.</span>
        </div>
      } @else {
        <div class="pdf-placeholder">
          <span>Compile o documento para visualizar o PDF</span>
        </div>
      }
    </div>
  `,
  styleUrl: './pdf-preview.scss',
})
export class PdfPreview {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  readonly src = input<string | null>(null);
  protected readonly url = signal<SafeResourceUrl | null>(null);
  protected readonly error = signal(false);

  constructor() {
    effect((onCleanup) => {
      const src = this.src();
      if (!src) {
        this.url.set(null);
        this.error.set(false);
        return;
      }

      this.http
        .get(src, { responseType: 'blob', headers: { Accept: 'application/pdf' } })
        .subscribe({
          next: (blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
            this.error.set(false);
            onCleanup(() => URL.revokeObjectURL(objectUrl));
          },
          error: (err) => {
            // eslint-disable-next-line no-console
            console.error('PDF preview failed:', err);
            this.url.set(null);
            this.error.set(true);
          },
        });
    });
  }
}
