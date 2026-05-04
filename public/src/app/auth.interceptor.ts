import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_SERVICE } from './services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // During SSR there is no localStorage — skip adding the token
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const authService = inject(AUTH_SERVICE);
  const currentUser = authService.currentUser();

  if (currentUser?.token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${currentUser.token}`)
    });
    return next(authReq);
  }

  return next(req);
};
