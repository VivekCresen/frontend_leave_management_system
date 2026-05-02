import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AUTH_SERVICE } from './services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AUTH_SERVICE);
  const currentUser = authService.currentUser();
  
  if (currentUser && currentUser.token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${currentUser.token}`)
    });
    return next(authReq);
  }
  
  return next(req);
};
