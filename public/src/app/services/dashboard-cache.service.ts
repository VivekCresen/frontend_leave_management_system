import { Injectable } from '@angular/core';
import { UserDashboardResponse, AttendanceLogDto } from './auth.service';
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
  attendanceLogs: AttendanceLogDto[];
  myAttendanceLogs: AttendanceLogDto[];
  cachedAt: number;
};

const STORAGE_KEY = 'lms_dashboard_cache';

@Injectable({ providedIn: 'root' })
export class DashboardCacheService {
  private cache: DashboardCacheEntry | null = null;

  /** In-memory TTL before a background refresh is triggered (5 min) */
  private readonly maxAgeMs = 5 * 60 * 1000;

  /** Attendance-specific TTL — refresh after 2 min */
  private readonly attendanceTtlMs = 2 * 60 * 1000;

  constructor() {
    this.loadFromStorage();
  }

  get(username: string): DashboardCacheEntry | null {
    if (!this.cache || this.cache.username !== username) return null;
    return this.cache;
  }

  isStale(username: string): boolean {
    const entry = this.get(username);
    if (!entry) return true;
    return Date.now() - entry.cachedAt > this.maxAgeMs;
  }

  isAttendanceStale(username: string): boolean {
    const entry = this.get(username);
    if (!entry) return true;
    return Date.now() - entry.cachedAt > this.attendanceTtlMs;
  }

  set(entry: DashboardCacheEntry): void {
    this.cache = { ...entry, cachedAt: Date.now() };
    this.persistToStorage();
  }

  /** Patch only the attendance fields without touching the rest of the cache */
  setAttendance(username: string, attendanceLogs: AttendanceLogDto[], myAttendanceLogs: AttendanceLogDto[]): void {
    const entry = this.get(username);
    if (!entry) return;
    this.cache = { ...entry, attendanceLogs, myAttendanceLogs };
    this.persistToStorage();
  }

  invalidate(): void {
    this.cache = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  private persistToStorage(): void {
    if (!this.cache) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Storage quota exceeded or unavailable — silently ignore
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw) as DashboardCacheEntry;
      }
    } catch {
      this.cache = null;
    }
  }
}
