import { TranslateService } from '../i18n/translate.service';

export function makeTr(translate: TranslateService): (key: string, fallback: string) => string {
  return (key: string, fallback: string): string => {
    const v = translate.getTranslation(key);
    return v !== key ? v : fallback;
  };
}
