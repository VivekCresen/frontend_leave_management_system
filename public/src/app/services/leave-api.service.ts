import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateLeaveTypePayload, LeaveRecord, LeaveService, LeaveType } from './leave.service';

@Injectable({
  providedIn: 'root'
})
export class LeaveApiService implements LeaveService {
  private readonly apiUrl = this.resolveApiUrl();

  constructor(private readonly http: HttpClient) {}

  getLeaves(): Observable<LeaveRecord[]> {
    return this.http.get<LeaveRecord[]>(this.apiUrl);
  }

  getLeaveTypes(): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(`${this.apiUrl}/types`);
  }

  createLeaveType(payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.post<LeaveType>(`${this.apiUrl}/types`, {
      leaveName: payload.leaveName.trim(),
      leaveUniqueName: payload.leaveUniqueName.trim(),
      description: payload.description.trim(),
      maxDays: payload.maxDays
    });
  }

  updateLeaveType(leaveTypeId: number, payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.put<LeaveType>(`${this.apiUrl}/types/${leaveTypeId}`, {
      leaveName: payload.leaveName.trim(),
      leaveUniqueName: payload.leaveUniqueName.trim(),
      description: payload.description.trim(),
      maxDays: payload.maxDays
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
