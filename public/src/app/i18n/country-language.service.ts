import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, tap } from 'rxjs';
import { Language } from './translate.service';

interface IpApiResponse {
  country_code: string;
  country_name: string;
}

/** Maps an ISO 3166-1 alpha-2 country code to one of the supported app Language codes. */
export function countryToLanguage(countryCode: string): Language {
  const code = countryCode.toUpperCase();

  // Arabic-speaking countries
  const arabicCountries = ['SA', 'AE', 'EG', 'IQ', 'JO', 'KW', 'LB', 'LY', 'MA', 'OM', 'QA', 'SD', 'SY', 'TN', 'YE', 'BH', 'DZ', 'MR', 'PS', 'SO'];
  if (arabicCountries.includes(code)) return 'ar';

  // Chinese-speaking countries
  if (['CN', 'TW', 'HK', 'MO', 'SG'].includes(code)) return 'zh';

  // French-speaking countries
  const frenchCountries = ['FR', 'BE', 'CH', 'LU', 'MC', 'CD', 'CM', 'CI', 'MG', 'ML', 'BF', 'SN', 'NE', 'TG', 'BJ', 'GA', 'GN', 'CF', 'CG', 'MR', 'DJ', 'KM', 'SC', 'MU', 'HT', 'CA'];
  if (frenchCountries.includes(code)) return 'fr';

  // German-speaking countries
  if (['DE', 'AT', 'LI'].includes(code)) return 'de';

  // Spanish-speaking countries
  const spanishCountries = ['ES', 'MX', 'AR', 'CO', 'PE', 'VE', 'CL', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'GQ'];
  if (spanishCountries.includes(code)) return 'es';

  // Hindi-speaking countries (India, Nepal, Fiji, Mauritius, Trinidad)
  if (['IN', 'NP', 'FJ', 'TT'].includes(code)) return 'hi';

  // Russian-speaking countries
  if (['RU', 'BY', 'KZ', 'KG'].includes(code)) return 'ru';

  // Japanese-speaking countries
  if (code === 'JP') return 'ja';

  // Portuguese-speaking countries
  if (['BR', 'PT', 'AO', 'MZ', 'GW', 'TL', 'CV', 'ST'].includes(code)) return 'pt';

  // Korean-speaking countries
  if (['KR', 'KP'].includes(code)) return 'ko';

  // Italian-speaking countries
  if (['IT', 'SM', 'VA'].includes(code)) return 'it';

  // Turkish-speaking countries
  if (['TR', 'CY'].includes(code)) return 'tr';

  // Dutch-speaking countries
  if (['NL', 'SR', 'AW', 'CW', 'SX', 'BQ'].includes(code)) return 'nl';

  // Polish
  if (code === 'PL') return 'pl';

  // Thai
  if (code === 'TH') return 'th';

  // Vietnamese
  if (code === 'VN') return 'vi';

  // Indonesian
  if (code === 'ID') return 'id';

  // Swedish-speaking countries
  if (['SE', 'FI'].includes(code)) return 'sv';

  // Bengali-speaking countries
  if (code === 'BD') return 'bn';

  return 'en';
}

@Injectable({ providedIn: 'root' })
export class CountryLanguageService {
  private readonly sessionKey = 'cl_geo';
  private readonly apiUrl = 'https://ipapi.co/json/';

  constructor(private readonly http: HttpClient) {}

  /**
   * Priority 1: Use the country code from the user's DB profile.
   * Priority 2: Fall back to ipapi.co geolocation if no DB country is set.
   *
   * @param dbCountryCode  ISO 3166-1 alpha-2 code stored in the user profile (may be null/empty)
   * @param dbCountryName  Human-readable country name from the user profile
   */
  detectLanguageFromDbOrIp(
    dbCountryCode: string | null | undefined,
    dbCountryName: string | null | undefined
  ): Observable<{ lang: Language; countryName: string; countryCode: string; source: 'db' | 'ip' }> {
    // ── Priority 1: DB country ────────────────────────────────────
    if (dbCountryCode) {
      const lang = countryToLanguage(dbCountryCode);
      const countryName = dbCountryName || dbCountryCode;
      const result = { lang, countryName, countryCode: dbCountryCode, source: 'db' as const };
      return of(result);
    }

    // ── Priority 2: IP geolocation ────────────────────────────────
    return this.detectLanguage().pipe(
      map(r => ({ ...r, source: 'ip' as const }))
    );
  }

  /**
   * Returns the detected Language code and country name via IP geolocation.
   * Uses sessionStorage to cache results within a single browser session.
   */
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

  /** Whether the user already has a saved language preference for this username. */
  hasSavedPreference(username: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(`app_lang_${username}`) !== null;
  }

  /** Whether the language-popup has already been shown this session. */
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
