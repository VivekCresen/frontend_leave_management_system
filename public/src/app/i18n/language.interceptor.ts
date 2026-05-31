import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TranslateService } from './translate.service';

export const languageInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const translateService = inject(TranslateService);
  const currentLanguage = translateService.currentLang();

  const newReq = req.clone({
    setHeaders: {
      'Accept-Language': currentLanguage || 'en'
    }
  });

  return next(newReq);
};
