import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'app_theme';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  currentTheme = signal<Theme>(this.loadTheme());

  constructor() {
    effect(() => {
      const theme = this.currentTheme();
      if (this.isBrowser) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.storageKey, theme);
      }
    });
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }

  toggle(): void {
    this.currentTheme.set(this.currentTheme() === 'light' ? 'dark' : 'light');
  }

  get isDark(): boolean {
    return this.currentTheme() === 'dark';
  }

  private loadTheme(): Theme {
    if (this.isBrowser) {
      const saved = localStorage.getItem(this.storageKey) as Theme;
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  }
}
