import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Language, LANGUAGE_NAMES } from '../i18n/translate.service';

/** Bilingual label pairs shown inside the popup for each language. */
const POPUP_LABELS: Record<Language, { headline: string; subline: string; keepBtn: string; switchBtn: string }> = {
  hi: {
    headline: 'भाषा स्वचालित रूप से सेट की गई',
    subline: 'हमने आपका क्षेत्र {country} पहचाना। भाषा हिन्दी में बदल दी गई है।',
    keepBtn: 'हिन्दी रखें',
    switchBtn: 'अंग्रेज़ी में बदलें'
  },
  fr: {
    headline: 'Langue détectée automatiquement',
    subline: 'Nous avons détecté votre région : {country}. La langue a été définie sur le Français.',
    keepBtn: 'Garder le Français',
    switchBtn: "Passer à l'Anglais"
  },
  de: {
    headline: 'Sprache automatisch erkannt',
    subline: 'Wir haben Ihre Region erkannt: {country}. Die Sprache wurde auf Deutsch gesetzt.',
    keepBtn: 'Deutsch behalten',
    switchBtn: 'Zu Englisch wechseln'
  },
  es: {
    headline: 'Idioma detectado automáticamente',
    subline: 'Hemos detectado su región: {country}. El idioma se ha establecido en Español.',
    keepBtn: 'Mantener Español',
    switchBtn: 'Cambiar a Inglés'
  },
  zh: {
    headline: '已自动检测语言',
    subline: '我们检测到您的地区：{country}。语言已设置为中文。',
    keepBtn: '保留中文',
    switchBtn: '切换到英文'
  },
  ru: {
    headline: 'Язык определён автоматически',
    subline: 'Мы определили ваш регион: {country}. Язык установлен на Русский.',
    keepBtn: 'Оставить Русский',
    switchBtn: 'Переключить на Английский'
  },
  ja: {
    headline: '言語が自動設定されました',
    subline: 'お住まいの地域：{country} を検出しました。言語を日本語に設定しました。',
    keepBtn: '日本語のまま',
    switchBtn: '英語に切り替え'
  },
  ar: {
    headline: 'تم اكتشاف اللغة تلقائياً',
    subline: 'لقد اكتشفنا منطقتك: {country}. تم تعيين اللغة إلى العربية.',
    keepBtn: 'الاستمرار بالعربية',
    switchBtn: 'التبديل إلى الإنجليزية'
  },
  en: {
    headline: 'Language detected',
    subline: 'We detected your region: {country}.',
    keepBtn: 'Keep English',
    switchBtn: 'Switch to English'
  },
  pt: {
    headline: 'Idioma detectado automaticamente',
    subline: 'Detectámos a sua região: {country}. O idioma foi definido para Português.',
    keepBtn: 'Manter Português',
    switchBtn: 'Mudar para Inglês'
  },
  ko: {
    headline: '언어가 자동 감지되었습니다',
    subline: '귀하의 지역이 감지되었습니다: {country}. 언어가 한국어로 설정되었습니다.',
    keepBtn: '한국어 유지',
    switchBtn: '영어로 변경'
  },
  it: {
    headline: 'Lingua rilevata automaticamente',
    subline: 'Abbiamo rilevato la tua regione: {country}. La lingua è stata impostata su Italiano.',
    keepBtn: 'Mantieni Italiano',
    switchBtn: 'Passa all\'Inglese'
  },
  tr: {
    headline: 'Dil otomatik olarak algılandı',
    subline: 'Bölgeniz algılandı: {country}. Dil Türkçe olarak ayarlandı.',
    keepBtn: 'Türkçe Kalsın',
    switchBtn: 'İngilizceye Geç'
  },
  nl: {
    headline: 'Taal automatisch gedetecteerd',
    subline: 'We hebben uw regio gedetecteerd: {country}. De taal is ingesteld op Nederlands.',
    keepBtn: 'Nederlands behouden',
    switchBtn: 'Overschakelen naar Engels'
  },
  pl: {
    headline: 'Język wykryty automatycznie',
    subline: 'Wykryliśmy Twój region: {country}. Język został ustawiony na Polski.',
    keepBtn: 'Zachowaj Polski',
    switchBtn: 'Przełącz na Angielski'
  },
  th: {
    headline: 'ตรวจพบภาษาโดยอัตโนมัติ',
    subline: 'เราตรวจพบภูมิภาคของคุณ: {country} ภาษาถูกตั้งเป็นภาษาไทย',
    keepBtn: 'ใช้ภาษาไทย',
    switchBtn: 'เปลี่ยนเป็นภาษาอังกฤษ'
  },
  vi: {
    headline: 'Ngôn ngữ được phát hiện tự động',
    subline: 'Chúng tôi đã phát hiện khu vực của bạn: {country}. Ngôn ngữ đã được đặt thành Tiếng Việt.',
    keepBtn: 'Giữ Tiếng Việt',
    switchBtn: 'Chuyển sang Tiếng Anh'
  },
  id: {
    headline: 'Bahasa terdeteksi secara otomatis',
    subline: 'Kami mendeteksi wilayah Anda: {country}. Bahasa telah diatur ke Bahasa Indonesia.',
    keepBtn: 'Pertahankan Bahasa Indonesia',
    switchBtn: 'Beralih ke Bahasa Inggris'
  },
  sv: {
    headline: 'Språk upptäckt automatiskt',
    subline: 'Vi upptäckte din region: {country}. Språket har ställts in på Svenska.',
    keepBtn: 'Behåll Svenska',
    switchBtn: 'Byt till Engelska'
  },
  bn: {
    headline: 'ভাষা স্বয়ংক্রিয়ভাবে সনাক্ত হয়েছে',
    subline: 'আমরা আপনার অঞ্চল সনাক্ত করেছি: {country}। ভাষা বাংলায় সেট করা হয়েছে।',
    keepBtn: 'বাংলা রাখুন',
    switchBtn: 'ইংরেজিতে পরিবর্তন করুন'
  }
};

@Component({
  selector: 'app-language-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-popup.component.html',
  styleUrls: ['./language-popup.component.css']
})
export class LanguagePopupComponent implements OnInit {
  @Input() detectedLang: Language = 'en';
  @Input() countryName = '';
  @Input() source: 'db' | 'ip' = 'ip';
  @Output() keepLanguage = new EventEmitter<void>();
  @Output() switchToEnglish = new EventEmitter<void>();

  labels!: { headline: string; subline: string; keepBtn: string; switchBtn: string };
  langName = '';
  sublineText = '';
  isRtl = false;

  readonly LANGUAGE_NAMES = LANGUAGE_NAMES;

  ngOnInit(): void {
    this.labels = POPUP_LABELS[this.detectedLang] ?? POPUP_LABELS['en'];
    this.langName = LANGUAGE_NAMES[this.detectedLang];
    this.sublineText = this.labels.subline.replace('{country}', this.countryName);
    this.isRtl = this.detectedLang === 'ar';
  }

  onKeep(): void {
    this.keepLanguage.emit();
  }

  onSwitch(): void {
    this.switchToEnglish.emit();
  }
}
