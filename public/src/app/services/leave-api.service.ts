import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateHolidayPayload, CreateLeavePayload, CreateLeaveTypePayload, Holiday, LeaveRecord, LeaveService, LeaveType, NotifyUser, UpdateLeavePayload, UpdateLeaveStatusPayload } from './leave.service';

@Injectable({
  providedIn: 'root'
})
export class LeaveApiService implements LeaveService {
  private readonly apiUrl = this.resolveApiUrl();
  private readonly holidayUrl = this.resolveHolidayUrl();

  constructor(private readonly http: HttpClient) {}

  getLeaves(): Observable<LeaveRecord[]> {
    return this.http.get<{ content: LeaveRecord[] }>(this.apiUrl).pipe(
      map((response) => response.content ?? [])
    );
  }

  getLeavesByUsername(username: string): Observable<LeaveRecord[]> {
    return this.http.get<{ content: LeaveRecord[] }>(
      `${this.apiUrl}/by-username/${encodeURIComponent(username)}?size=200`
    ).pipe(map((response) => response.content ?? []));
  }

  getLeavesByManagerUsername(managerUsername: string): Observable<LeaveRecord[]> {
    return this.http.get<{ content: LeaveRecord[] }>(
      `${this.apiUrl}/by-manager/${encodeURIComponent(managerUsername)}?size=200`
    ).pipe(map((response) => response.content ?? []));
  }

  getLeaveTypes(): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(`${this.apiUrl}/types`);
  }

  getNotifyUsers(username: string): Observable<NotifyUser[]> {
    return this.http.get<NotifyUser[]>(
      `${this.apiUrl}/notify-users?username=${encodeURIComponent(username)}`
    );
  }

  getHolidays(year?: number): Observable<Holiday[]> {
    const url = year ? `${this.holidayUrl}?year=${year}` : this.holidayUrl;
    return this.http.get<Holiday[]>(url);
  }

  createHoliday(payload: CreateHolidayPayload): Observable<Holiday> {
    return this.http.post<Holiday>(this.holidayUrl, payload);
  }

  updateHoliday(id: number, payload: CreateHolidayPayload): Observable<Holiday> {
    return this.http.put<Holiday>(`${this.holidayUrl}/${id}`, payload);
  }

  deleteHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${this.holidayUrl}/${id}`);
  }

  createLeave(payload: CreateLeavePayload): Observable<LeaveRecord> {
    return this.http.post<LeaveRecord>(this.apiUrl, {
      username: payload.username,
      leaveTypeId: payload.leaveTypeId,
      leaveDates: payload.leaveDates,
      reason: payload.reason,
      comments: payload.comments,
      notifyUserIds: payload.notifyUserIds ?? []
    });
  }

  updateLeave(leaveId: number, payload: UpdateLeavePayload): Observable<LeaveRecord> {
    return this.http.put<LeaveRecord>(`${this.apiUrl}/${leaveId}`, {
      leaveTypeId: payload.leaveTypeId,
      leaveDates: payload.leaveDates,
      reason: payload.reason,
      comments: payload.comments,
      notifyUserIds: payload.notifyUserIds ?? []
    });
  }

  deleteLeave(leaveId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${leaveId}`);
  }

  updateLeaveStatus(leaveId: number, payload: UpdateLeaveStatusPayload): Observable<LeaveRecord> {
    return this.http.put<LeaveRecord>(`${this.apiUrl}/${leaveId}/status`, {
      actorUsername: payload.actorUsername,
      status: payload.status,
      rejectionReason: payload.rejectionReason ?? null
    });
  }

  createLeaveType(payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.post<LeaveType>(`${this.apiUrl}/types`, {
      leaveName: payload.leaveName.trim(),
      leaveUniqueName: payload.leaveUniqueName.trim(),
      description: payload.description.trim(),
      maxDays: payload.maxDays,
      genderRestriction: payload.genderRestriction || null
    });
  }

  updateLeaveType(leaveTypeId: number, payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.put<LeaveType>(`${this.apiUrl}/types/${leaveTypeId}`, {
      leaveName: payload.leaveName.trim(),
      leaveUniqueName: payload.leaveUniqueName.trim(),
      description: payload.description.trim(),
      maxDays: payload.maxDays,
      genderRestriction: payload.genderRestriction || null
    });
  }

  deleteLeaveType(leaveTypeId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/types/${leaveTypeId}`);
  }

  private resolveApiUrl(): string {
    const configuredApiUrl = this.readConfiguredApiUrl();
    if (configuredApiUrl) {
      return configuredApiUrl;
    }

    const location = globalThis.location;
    if (!location?.hostname) {
      return 'http://localhost:8082/api/leaves';
    }

    const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${location.hostname}:8082/api/leaves`;
  }

  private resolveHolidayUrl(): string {
    const base = this.resolveApiUrl().replace(/\/api\/leaves.*$/, '');
    return `${base}/api/holidays`;
  }

  private readConfiguredApiUrl(): string | null {
    const windowConfig = (globalThis as typeof globalThis & { __LEAVE_APP_LEAVE_API_URL__?: string })
      .__LEAVE_APP_LEAVE_API_URL__;
    if (windowConfig?.trim()) {
      return this.normalizeApiUrl(windowConfig);
    }

    const metaTagValue = globalThis.document
      ?.querySelector('meta[name="leave-app-leave-api-url"]')
      ?.getAttribute('content');

    if (!metaTagValue?.trim()) {
      return null;
    }

    return this.normalizeApiUrl(metaTagValue);
  }

  private normalizeApiUrl(value: string): string {
    return value.trim().replace(/\/+$/, '');
  }
}
