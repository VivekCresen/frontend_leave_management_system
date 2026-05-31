import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveAuditCacheService } from './leave-audit-cache.service';
import { formatDateTime } from '../commons/date.util';


@Component({
  selector: 'app-leave-audit-cache-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cache-manager">
      <h3>Leave Audit Trail Cache</h3>
      
      <div class="cache-stats">
        <div class="stat-item">
          <span class="stat-label">Total Cached Leaves:</span>
          <span class="stat-value">{{ stats.totalEntries }}</span>
        </div>
        
        <div class="stat-item" *ngIf="stats.oldestEntry">
          <span class="stat-label">Oldest Entry:</span>
          <span class="stat-value">{{ formatDate(stats.oldestEntry) }}</span>
        </div>
        
        <div class="stat-item" *ngIf="stats.newestEntry">
          <span class="stat-label">Newest Entry:</span>
          <span class="stat-value">{{ formatDate(stats.newestEntry) }}</span>
        </div>
      </div>
      
      <div class="cache-actions">
        <button 
          class="btn btn-warning" 
          (click)="cleanupOldEntries()"
          [disabled]="stats.totalEntries === 0">
          Cleanup Old Entries (30+ days)
        </button>
        
        <button 
          class="btn btn-danger" 
          (click)="clearCache()"
          [disabled]="stats.totalEntries === 0">
          Clear All Cache
        </button>
      </div>
      
      <div class="cache-info">
        <p>
          <i class="fa fa-info-circle"></i>
          The audit trail cache stores leave IDs locally to reduce API calls.
          Only leave IDs are stored, not the actual audit data.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .cache-manager {
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      margin: 20px 0;
    }

    h3 {
      margin-top: 0;
      color: #333;
      font-size: 1.2rem;
      margin-bottom: 15px;
    }

    .cache-stats {
      background: white;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 15px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .stat-item:last-child {
      border-bottom: none;
    }

    .stat-label {
      font-weight: 500;
      color: #666;
    }

    .stat-value {
      color: #333;
      font-weight: 600;
    }

    .cache-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-warning {
      background: #ffc107;
      color: #000;
    }

    .btn-warning:hover:not(:disabled) {
      background: #e0a800;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #c82333;
    }

    .cache-info {
      background: #e7f3ff;
      padding: 12px;
      border-radius: 4px;
      border-left: 4px solid #0066cc;
    }

    .cache-info p {
      margin: 0;
      color: #004085;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cache-info i {
      color: #0066cc;
    }
  `]
})
export class LeaveAuditCacheManagerComponent implements OnInit {
  stats = {
    totalEntries: 0,
    oldestEntry: null as number | null,
    newestEntry: null as number | null
  };

  constructor(private readonly cacheService: LeaveAuditCacheService) {}

  ngOnInit(): void {
    this.refreshStats();
  }

  refreshStats(): void {
    this.stats = this.cacheService.getCacheStats();
  }

  cleanupOldEntries(): void {
    const removed = this.cacheService.cleanupOldEntries(30);
    this.refreshStats();
    alert(`Removed ${removed} old entries from cache.`);
  }

  clearCache(): void {
    if (confirm('Are you sure you want to clear all cached leave audit trail data?')) {
      this.cacheService.clearCache();
      this.refreshStats();
      alert('Cache cleared successfully.');
    }
  }

  formatDate(timestamp: number): string {
    return formatDateTime(new Date(timestamp).toISOString());
  }
}
