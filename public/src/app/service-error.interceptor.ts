import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './services/toast.service';

const SERVICE_MESSAGES: Record<number, string> = {
  503: 'A service is temporarily unavailable. Please try again shortly.',
  502: 'Could not reach the server. Please check your connection.',
  504: 'The server took too long to respond. Please try again.',
};

export const serviceErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message = SERVICE_MESSAGES[err.status];
      if (message) {
        // Don't show toast for chatbot — it handles its own fallback message
        const isChatbot = req.url.includes('/api/chatbot/');
        if (!isChatbot) {
          toast.error(message);
        }
      }
      return throwError(() => err);
    })
  );
};
