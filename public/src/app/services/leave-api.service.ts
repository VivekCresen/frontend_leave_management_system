import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateLeavePayload, CreateLeaveTypePayload, LeaveRecord, LeaveService, LeaveType, UpdateLeaveStatusPayload } from './leave.service';

@Injectable({
  providedIn: 'root'
})
export class LeaveApiService implements LeaveService {
  private readonly apiUrl = this.resolveApiUrl();

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

  createLeave(payload: CreateLeavePayload): Observable<LeaveRecord> {
    return this.http.post<LeaveRecord>(this.apiUrl, {
      username: payload.username,
      leaveTypeId: payload.leaveTypeId,
      leaveType: payload.leaveType,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      reason: payload.reason,
      comments: payload.comments
    });
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
