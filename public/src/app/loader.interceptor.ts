import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoaderService } from './shared/services/loader.service';

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  const loaderService = inject(LoaderService);
  const isChatbotRequest = req.url.includes('/api/chatbot/');
  
  if (req.method === 'GET' || req.headers.has('X-Skip-Loader') || isChatbotRequest) {
    return next(req);
  }

  loaderService.show();
  
  return next(req).pipe(
    finalize(() => {
      loaderService.hide();
    })
  );
};
