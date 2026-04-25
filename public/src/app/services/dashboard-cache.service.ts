import { Injectable } from '@angular/core';
import { UserDashboardResponse } from './auth.service';
import { LeaveType, Holiday } from './leave.service';
import { AdminLeaveTableRow } from '../dashboard/components/dashboard-leave-table.component';

export type DashboardCacheEntry = {
  username: string;
  dashboard: UserDashboardResponse;
  leaveTypes: LeaveType[];
  holidays: Holiday[];
  leaves: AdminLeaveTableRow[];        
  managerLeaves: AdminLeaveTableRow[]; 
  myLeaves: AdminLeaveTableRow[];      
  cachedAt: number;
};

@Injectable({ providedIn: 'root' })
export class DashboardCacheService {
  private cache: DashboardCacheEntry | null = null;

  private readonly maxAgeMs = 5 * 60 * 1000;

  get(username: string): DashboardCacheEntry | null {
    if (!this.cache || this.cache.username !== username) return null;
    return this.cache;
  }

  isStale(username: string): boolean {
    const entry = this.get(username);
    if (!entry) return true;
    return Date.now() - entry.cachedAt > this.maxAgeMs;
  }

  set(entry: DashboardCacheEntry): void {
    this.cache = { ...entry, cachedAt: Date.now() };
  }

  invalidate(): void {
    this.cache = null;
  }
}
