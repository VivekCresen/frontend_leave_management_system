import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { AuthApiService } from './services/auth-api.service';
import { AUTH_SERVICE } from './services/auth.service';
import { loaderInterceptor } from './loader.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([loaderInterceptor])),
    provideClientHydration(withEventReplay()),
    AuthApiService,
    { provide: AUTH_SERVICE, useExisting: AuthApiService }
  ]
};
