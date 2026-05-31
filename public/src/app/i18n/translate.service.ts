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
import { TRANSLATIONS_PT } from './translations/pt';
import { TRANSLATIONS_KO } from './translations/ko';
import { TRANSLATIONS_IT } from './translations/it';
import { TRANSLATIONS_TR } from './translations/tr';
import { TRANSLATIONS_NL } from './translations/nl';
import { TRANSLATIONS_PL } from './translations/pl';
import { TRANSLATIONS_TH } from './translations/th';
import { TRANSLATIONS_VI } from './translations/vi';
import { TRANSLATIONS_ID } from './translations/id';
import { TRANSLATIONS_SV } from './translations/sv';
import { TRANSLATIONS_BN } from './translations/bn';

export type Language = 'en' | 'es' | 'fr' | 'zh' | 'de' | 'ru' | 'ja' | 'ar' | 'hi'
  | 'pt' | 'ko' | 'it' | 'tr' | 'nl' | 'pl' | 'th' | 'vi' | 'id' | 'sv' | 'bn';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  zh: '中文',
  de: 'Deutsch',
  ru: 'Русский',
  ja: '日本語',
  ar: 'العربية',
  hi: 'हिन्दी',
  pt: 'Português',
  ko: '한국어',
  it: 'Italiano',
  tr: 'Türkçe',
  nl: 'Nederlands',
  pl: 'Polski',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  sv: 'Svenska',
  bn: 'বাংলা'
};

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
    hi: TRANSLATIONS_HI,
    pt: TRANSLATIONS_PT,
    ko: TRANSLATIONS_KO,
    it: TRANSLATIONS_IT,
    tr: TRANSLATIONS_TR,
    nl: TRANSLATIONS_NL,
    pl: TRANSLATIONS_PL,
    th: TRANSLATIONS_TH,
    vi: TRANSLATIONS_VI,
    id: TRANSLATIONS_ID,
    sv: TRANSLATIONS_SV,
    bn: TRANSLATIONS_BN
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

  setLanguageTemp(lang: Language): void {
    if (!this.dictionaries[lang]) return;
    this.currentLang.set(lang);
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
