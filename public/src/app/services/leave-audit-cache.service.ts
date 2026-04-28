import { Injectable } from '@angular/core';

export interface LeaveAuditCacheEntry {
  leaveId: number;
  cachedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class LeaveAuditCacheService {
  private readonly storageKey = 'leave-audit-trail-cache';
  private readonly maxCacheSize = 500; // Maximum number of leave IDs to store

  /**
   * Check if a leave ID exists in the cache
   */
  hasLeaveInCache(leaveId: number): boolean {
    const cache = this.getCache();
    return cache.some(entry => entry.leaveId === leaveId);
  }

  /**
   * Add a leave ID to the cache
   */
  addLeaveToCache(leaveId: number): void {
    let cache = this.getCache();
    
    // Remove existing entry if present
    cache = cache.filter(entry => entry.leaveId !== leaveId);
    
    // Add new entry at the beginning
    cache.unshift({
      leaveId,
      cachedAt: Date.now()
    });
    
    // Limit cache size (keep most recent entries)
    if (cache.length > this.maxCacheSize) {
      cache = cache.slice(0, this.maxCacheSize);
    }
    
    this.saveCache(cache);
  }

  /**
   * Remove a leave ID from the cache
   */
  removeLeaveFromCache(leaveId: number): void {
    const cache = this.getCache().filter(entry => entry.leaveId !== leaveId);
    this.saveCache(cache);
  }

  /**
   * Get all cached leave IDs
   */
  getCachedLeaveIds(): number[] {
    return this.getCache().map(entry => entry.leaveId);
  }

  /**
   * Clear all cached leave IDs
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear leave audit cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEntries: number; oldestEntry: number | null; newestEntry: number | null } {
    const cache = this.getCache();
    
    if (cache.length === 0) {
      return { totalEntries: 0, oldestEntry: null, newestEntry: null };
    }
    
    const timestamps = cache.map(entry => entry.cachedAt);
    
    return {
      totalEntries: cache.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps)
    };
  }

  /**
   * Remove entries older than specified days
   */
  cleanupOldEntries(daysOld: number = 30): number {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const cache = this.getCache();
    const filteredCache = cache.filter(entry => entry.cachedAt >= cutoffTime);
    const removedCount = cache.length - filteredCache.length;
    
    if (removedCount > 0) {
      this.saveCache(filteredCache);
    }
    
    return removedCount;
  }

  private getCache(): LeaveAuditCacheEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return [];
      }
      
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }
      
      return parsed.filter(entry => 
        entry && 
        typeof entry === 'object' && 
        typeof entry.leaveId === 'number' &&
        typeof entry.cachedAt === 'number'
      );
    } catch (error) {
      console.warn('Failed to read leave audit cache:', error);
      return [];
    }
  }

  private saveCache(cache: LeaveAuditCacheEntry[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to save leave audit cache:', error);
      // If storage is full, try to clear old entries and retry
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.cleanupOldEntries(7); // Keep only last 7 days
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(cache));
        } catch (retryError) {
          console.error('Failed to save cache even after cleanup:', retryError);
        }
      }
    }
  }
}
