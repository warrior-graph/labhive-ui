import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: dark)')
    : ({ matches: false, addEventListener: () => undefined } as unknown as MediaQueryList);
  readonly preference = signal<ThemePreference>(this.readPreference());

  constructor() {
    this.apply();
    this.media.addEventListener('change', () => {
      if (this.preference() === 'system') this.apply();
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    localStorage.setItem('theme', preference);
    this.apply();
  }

  readonly resolvedTheme = () =>
    this.preference() === 'system' ? (this.media.matches ? 'dark' : 'light') : this.preference();

  private readPreference(): ThemePreference {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  }

  private apply(): void {
    const theme = this.resolvedTheme();
    this.document.documentElement.dataset['theme'] = theme;
    this.document.documentElement.style.colorScheme = theme;
  }
}
