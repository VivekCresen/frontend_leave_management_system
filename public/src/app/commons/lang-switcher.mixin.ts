import { Directive, HostListener } from '@angular/core';
import { TranslateService, Language } from '../i18n/translate.service';
import { CalendarBase } from '../dashboard/components/calendar-base';

@Directive()
export abstract class LangSwitcherMixin extends CalendarBase {
  abstract readonly translateService: TranslateService;

  isLangDropdownOpen = false;

  readonly availableLangs: { code: string; label: string }[] = [
    { code: 'en', label: 'English (US)' },
    { code: 'es', label: 'Español (ES)' },
    { code: 'fr', label: 'Français (FR)' },
    { code: 'de', label: 'Deutsch (DE)' },
    { code: 'zh', label: '中文 (ZH)' },
    { code: 'ru', label: 'Русский (RU)' },
    { code: 'ja', label: '日本語 (JA)' },
    { code: 'ar', label: 'العربية (AR)' },
    { code: 'hi', label: 'हिन्दी (HI)' },
    { code: 'pt', label: 'Português (PT)' },
    { code: 'ko', label: '한국어 (KO)' },
    { code: 'it', label: 'Italiano (IT)' },
    { code: 'tr', label: 'Türkçe (TR)' },
    { code: 'nl', label: 'Nederlands (NL)' },
    { code: 'pl', label: 'Polski (PL)' },
    { code: 'th', label: 'ไทย (TH)' },
    { code: 'vi', label: 'Tiếng Việt (VI)' },
    { code: 'id', label: 'Bahasa Indonesia (ID)' },
    { code: 'sv', label: 'Svenska (SV)' },
    { code: 'bn', label: 'বাংলা (BN)' }
  ];

  getSelectedLangLabel(): string {
    const code = this.translateService.currentLang() || 'en';
    return this.availableLangs.find((l) => l.code === code)?.label ?? 'Select language';
  }

  toggleLangDropdown(event: Event): void {
    event.stopPropagation();
    this.isLangDropdownOpen = !this.isLangDropdownOpen;
  }

  selectLang(code: string): void {
    this.translateService.setLanguage(code as Language);
    this.isLangDropdownOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isLangDropdownOpen = false;
  }
}
