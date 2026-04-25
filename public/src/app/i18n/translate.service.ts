import { Injectable, signal } from '@angular/core';
import { TRANSLATIONS_EN } from './translations/en';
import { TRANSLATIONS_ES } from './translations/es';
import { TRANSLATIONS_FR } from './translations/fr';
import { TRANSLATIONS_ZH } from './translations/zh';
import { TRANSLATIONS_DE } from './translations/de';
import { TRANSLATIONS_RU } from './translations/ru';
import { TRANSLATIONS_JA } from './translations/ja';
import { TRANSLATIONS_AR } from './translations/ar';
import { TRANSLATIONS_HI } from './translations/hi';

export type Language = 'en' | 'es' | 'fr' | 'zh' | 'de' | 'ru' | 'ja' | 'ar' | 'hi';

@Injectable({
  providedIn: 'root'
})
export class TranslateService {
  private readonly defaultLang: Language = 'en';
  currentLang = signal<Language>(this.defaultLang);
  private currentUsername: string | null = null;

  private readonly dictionaries: Record<Language, any> = {
    en: TRANSLATIONS_EN,
    es: TRANSLATIONS_ES,
    fr: TRANSLATIONS_FR,
    zh: TRANSLATIONS_ZH,
    de: TRANSLATIONS_DE,
    ru: TRANSLATIONS_RU,
    ja: TRANSLATIONS_JA,
    ar: TRANSLATIONS_AR,
    hi: TRANSLATIONS_HI
  };

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const anyKey = Object.keys(localStorage).find(k => k.startsWith('app_lang_'));
      if (!anyKey) return;
    }
  }

  initForUser(username: string): void {
    this.currentUsername = username;
    if (typeof localStorage === 'undefined') return;
    const key = this._langKey(username);
    const saved = localStorage.getItem(key) as Language;
    if (saved && this.dictionaries[saved]) {
      this.currentLang.set(saved);
    } else {
      this.currentLang.set(this.defaultLang);
    }
  }

  resetForLogout(): void {
    this.currentUsername = null;
    this.currentLang.set(this.defaultLang);
  }

  setLanguage(lang: Language): void {
    if (!this.dictionaries[lang]) return;
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined' && this.currentUsername) {
      localStorage.setItem(this._langKey(this.currentUsername), lang);
    }
  }

  getTranslation(key: string): string {
    const lang = this.currentLang();
    const dictionary = this.dictionaries[lang] || this.dictionaries[this.defaultLang];
    const value = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dictionary);
    return value !== null ? value : key;
  }

  private _langKey(username: string): string {
    return `app_lang_${username}`;
  }
}
