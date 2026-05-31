import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse
} from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from '../services/cache.service';


@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  
  private readonly CACHEABLE_URLS = [
    '/api/leave-types',
    '/api/public-holidays',
    '/api/countries',
    '/api/phone-codes',
    '/api/users/profile',
    '/api/leave/balance',
    '/api/chatbot/history'
  ];

 
  private readonly NON_CACHEABLE_URLS = [
    '/api/auth',
    '/api/login',
    '/api/logout',
    '/api/chatbot/chat'
  ];

  private readonly CACHE_TTL: Record<string, number> = {
    '/api/leave-types': 3600,       
    '/api/public-holidays': 3600,    
    '/api/countries': 86400,         
    '/api/phone-codes': 86400,       
    '/api/users/profile': 1800,      
    '/api/leave/balance': 900,       
    '/api/chatbot/history': 300      
  };

  constructor(private cacheService: CacheService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    
    if (req.method !== 'GET') {
      return next.handle(req);
    }

    if (!this.shouldCache(req.url)) {
      return next.handle(req);
    }

    if (req.headers.has('X-Skip-Cache')) {
      return next.handle(req);
    }

    return new Observable(observer => {
      this.cacheService.getCachedApiResponse(req.url).then(cachedResponse => {
        if (cachedResponse) {
          console.log('✅ Serving from cache:', req.url);
          observer.next(new HttpResponse({
            body: cachedResponse,
            status: 200,
            statusText: 'OK (from cache)'
          }));
          observer.complete();
        } else {
          next.handle(req).pipe(
            tap(event => {
              if (event instanceof HttpResponse && event.status === 200) {
                const ttl = this.getTTL(req.url);
                this.cacheService.cacheApiResponse(req.url, event.body, ttl);
                console.log('💾 Cached response:', req.url, `(TTL: ${ttl}s)`);
              }
            })
          ).subscribe({
            next: event => observer.next(event),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        }
      }).catch(error => {
        console.error('Cache error:', error);
        next.handle(req).subscribe({
          next: event => observer.next(event),
          error: err => observer.error(err),
          complete: () => observer.complete()
        });
      });
    });
  }
  private shouldCache(url: string): boolean {
    if (this.NON_CACHEABLE_URLS.some(pattern => url.includes(pattern))) {
      return false;
    }

    return this.CACHEABLE_URLS.some(pattern => url.includes(pattern));
  }

  private getTTL(url: string): number {
    for (const [pattern, ttl] of Object.entries(this.CACHE_TTL)) {
      if (url.includes(pattern)) {
        return ttl;
      }
    }
    return 300; 
  }
}
