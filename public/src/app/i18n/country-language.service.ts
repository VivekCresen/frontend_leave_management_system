import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, tap } from 'rxjs';
import { Language } from './translate.service';

interface IpApiResponse {
  country_code: string;
  country_name: string;
}

export function countryToLanguage(countryCode: string): Language {
  const code = countryCode.toUpperCase();

  const arabicCountries = ['SA', 'AE', 'EG', 'IQ', 'JO', 'KW', 'LB', 'LY', 'MA', 'OM', 'QA', 'SD', 'SY', 'TN', 'YE', 'BH', 'DZ', 'MR', 'PS', 'SO'];
  if (arabicCountries.includes(code)) return 'ar';

  if (['CN', 'TW', 'HK', 'MO', 'SG'].includes(code)) return 'zh';

  const frenchCountries = ['FR', 'BE', 'CH', 'LU', 'MC', 'CD', 'CM', 'CI', 'MG', 'ML', 'BF', 'SN', 'NE', 'TG', 'BJ', 'GA', 'GN', 'CF', 'CG', 'MR', 'DJ', 'KM', 'SC', 'MU', 'HT', 'CA'];
  if (frenchCountries.includes(code)) return 'fr';

  if (['DE', 'AT', 'LI'].includes(code)) return 'de';

  const spanishCountries = ['ES', 'MX', 'AR', 'CO', 'PE', 'VE', 'CL', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ'];
  if (spanishCountries.includes(code)) return 'es';

  if (['IN', 'NP', 'FJ', 'TT'].includes(code)) return 'hi';

  if (['RU', 'BY', 'KZ', 'KG'].includes(code)) return 'ru';

  if (code === 'JP') return 'ja';

  if (['BR', 'PT', 'AO', 'MZ', 'GW', 'TL', 'CV', 'ST'].includes(code)) return 'pt';

  if (['KR', 'KP'].includes(code)) return 'ko';

  if (['IT', 'SM', 'VA'].includes(code)) return 'it';

  if (['TR', 'CY'].includes(code)) return 'tr';

  if (['NL', 'SR', 'AW', 'CW', 'SX', 'BQ'].includes(code)) return 'nl';

  if (code === 'PL') return 'pl';

  if (code === 'TH') return 'th';

  if (code === 'VN') return 'vi';

  if (code === 'ID') return 'id';

  if (['SE', 'FI'].includes(code)) return 'sv';

  if (code === 'BD') return 'bn';

  return 'en';
}

@Injectable({ providedIn: 'root' })
export class CountryLanguageService {
  private readonly sessionKey = 'cl_geo';
  private readonly apiUrl = 'https://ipapi.co/json/';

  constructor(private readonly http: HttpClient) {}

  detectLanguageFromDbOrIp(
    dbCountryCode: string | null | undefined,
    dbCountryName: string | null | undefined
  ): Observable<{ lang: Language; countryName: string; countryCode: string; source: 'db' | 'ip' }> {
    if (dbCountryCode) {
      const lang = countryToLanguage(dbCountryCode);
      const countryName = dbCountryName || dbCountryCode;
      const result = { lang, countryName, countryCode: dbCountryCode, source: 'db' as const };
      return of(result);
    }

    return this.detectLanguage().pipe(
      map(r => ({ ...r, source: 'ip' as const }))
    );
  }

  detectLanguage(): Observable<{ lang: Language; countryName: string; countryCode: string }> {
    if (typeof sessionStorage !== 'undefined') {
      const cached = sessionStorage.getItem(this.sessionKey);
      if (cached) {
        try {
          return of(JSON.parse(cached) as { lang: Language; countryName: string; countryCode: string });
        } catch {
          sessionStorage.removeItem(this.sessionKey);
        }
      }
    }

    return this.http.get<IpApiResponse>(this.apiUrl).pipe(
      map(res => {
        const countryCode = res.country_code ?? 'US';
        const countryName = res.country_name ?? 'Unknown';
        const lang = countryToLanguage(countryCode);
        return { lang, countryName, countryCode };
      }),
      tap(result => {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(this.sessionKey, JSON.stringify(result));
        }
      }),
      catchError(() => of({ lang: 'en' as Language, countryName: 'Unknown', countryCode: 'US' }))
    );
  }

  hasSavedPreference(username: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(`app_lang_${username}`) !== null;
  }

  popupAlreadyShown(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem('cl_popup_shown') === '1';
  }

  markPopupShown(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cl_popup_shown', '1');
    }
  }
}
