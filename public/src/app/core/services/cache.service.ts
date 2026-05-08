import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private readonly CACHE_NAME = 'leave-management-cache-v1';
  private readonly CHAT_CACHE_NAME = 'leave-management-chat-cache-v1';
  private readonly API_CACHE_NAME = 'leave-management-api-cache-v1';

  constructor() {
    this.initializeCaches();
  }

 
  private async initializeCaches(): Promise<void> {
    if ('caches' in window) {
      try {
        await caches.open(this.CACHE_NAME);
        await caches.open(this.CHAT_CACHE_NAME);
        await caches.open(this.API_CACHE_NAME);
        console.log('✅ Cache Storage initialized');
      } catch (error) {
        console.error('❌ Failed to initialize cache storage:', error);
      }
    } else {
      console.warn('⚠️ Cache Storage API not supported, falling back to localStorage');
    }
  }

  async set(key: string, data: any, cacheName: string = this.CACHE_NAME): Promise<boolean> {
    if (!('caches' in window)) {
      return this.fallbackToLocalStorage('set', key, data);
    }

    try {
      const cache = await caches.open(cacheName);
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600',
          'X-Cached-At': new Date().toISOString()
        }
      });
      await cache.put(new Request(key), response);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return this.fallbackToLocalStorage('set', key, data);
    }
  }

 
  async get<T>(key: string, cacheName: string = this.CACHE_NAME): Promise<T | null> {
    if (!('caches' in window)) {
      return this.fallbackToLocalStorage('get', key);
    }

    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match(new Request(key));
      
      if (!response) {
        return this.fallbackToLocalStorage('get', key);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return this.fallbackToLocalStorage('get', key);
    }
  }


  async delete(key: string, cacheName: string = this.CACHE_NAME): Promise<boolean> {
    if (!('caches' in window)) {
      return this.fallbackToLocalStorage('delete', key);
    }

    try {
      const cache = await caches.open(cacheName);
      const deleted = await cache.delete(new Request(key));
      if (!deleted) {
        this.fallbackToLocalStorage('delete', key);
      }
      return deleted;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }


  async clear(cacheName: string = this.CACHE_NAME): Promise<boolean> {
    if (!('caches' in window)) {
      localStorage.clear();
      return true;
    }

    try {
      return await caches.delete(cacheName);
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }


  async keys(cacheName: string = this.CACHE_NAME): Promise<string[]> {
    if (!('caches' in window)) {
      return Object.keys(localStorage);
    }

    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      return requests.map(req => req.url);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  async has(key: string, cacheName: string = this.CACHE_NAME): Promise<boolean> {
    if (!('caches' in window)) {
      return localStorage.getItem(key) !== null;
    }

    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match(new Request(key));
      return response !== undefined;
    } catch (error) {
      return false;
    }
  }

  async setChatHistory(conversationId: string, data: any): Promise<boolean> {
    return this.set(`chat-${conversationId}`, data, this.CHAT_CACHE_NAME);
  }

  async getChatHistory<T>(conversationId: string): Promise<T | null> {
    return this.get<T>(`chat-${conversationId}`, this.CHAT_CACHE_NAME);
  }

  
  async getAllChatHistory(): Promise<Record<string, any>> {
    const keys = await this.keys(this.CHAT_CACHE_NAME);
    const chatKeys = keys.filter(k => k.includes('chat-'));
    const history: Record<string, any> = {};

    for (const key of chatKeys) {
      const conversationId = key.split('chat-')[1];
      const data = await this.getChatHistory(conversationId);
      if (data) {
        history[conversationId] = data;
      }
    }

    return history;
  }

  async cacheApiResponse(url: string, data: any, ttl: number = 3600): Promise<boolean> {
    return this.set(url, {
      data,
      cachedAt: Date.now(),
      ttl: ttl * 1000
    }, this.API_CACHE_NAME);
  }

  async getCachedApiResponse<T>(url: string): Promise<T | null> {
    const cached = await this.get<{ data: T; cachedAt: number; ttl: number }>(
      url,
      this.API_CACHE_NAME
    );

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.cachedAt > cached.ttl) {
      await this.delete(url, this.API_CACHE_NAME);
      return null;
    }

    return cached.data;
  }


  private fallbackToLocalStorage(operation: string, key: string, data?: any): any {
    try {
      switch (operation) {
        case 'set':
          localStorage.setItem(key, JSON.stringify(data));
          return true;
        case 'get':
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : null;
        case 'delete':
          localStorage.removeItem(key);
          return true;
        default:
          return null;
      }
    } catch (error) {
      console.error('localStorage fallback error:', error);
      return operation === 'get' ? null : false;
    }
  }

  async getStats(): Promise<{
    supported: boolean;
    caches: Array<{ name: string; size: number; keys: number }>;
  }> {
    const supported = 'caches' in window;
    
    if (!supported) {
      return {
        supported: false,
        caches: [{
          name: 'localStorage',
          size: new Blob(Object.values(localStorage)).size,
          keys: Object.keys(localStorage).length
        }]
      };
    }

    const cacheNames = [this.CACHE_NAME, this.CHAT_CACHE_NAME, this.API_CACHE_NAME];
    const stats = [];

    for (const name of cacheNames) {
      try {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        let totalSize = 0;

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }

        stats.push({
          name,
          size: totalSize,
          keys: keys.length
        });
      } catch (error) {
        console.error(`Error getting stats for ${name}:`, error);
      }
    }

    return { supported, caches: stats };
  }

  async clearAll(): Promise<void> {
    await this.clear(this.CACHE_NAME);
    await this.clear(this.CHAT_CACHE_NAME);
    await this.clear(this.API_CACHE_NAME);
    localStorage.clear();
    console.log('✅ All caches cleared');
  }
}
