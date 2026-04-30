import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { CreateHolidayPayload, CreateLeavePayload, CreateLeaveTypePayload, Holiday, LeaveRecord, LeaveService, LeaveType, MailLeaveDecisionPayload, NotifyUser, PartialLeaveStatusPayload, UpdateLeavePayload, UpdateLeaveStatusPayload } from './leave.service';
import { resolveApiUrl } from '../shared/api-url.util';
import { LeaveAuditCacheService } from './leave-audit-cache.service';

@Injectable({
  providedIn: 'root'
})
export class LeaveApiService implements LeaveService {
  private readonly apiUrl = resolveApiUrl('__LEAVE_APP_LEAVE_API_URL__', 'leave-app-leave-api-url', ':8080/api/leaves');
  private readonly holidayUrl = this.apiUrl.replace(/\/api\/leaves.*$/, '/api/holidays');
  private readonly cacheTtlMs = 60_000;
  private readonly responseCache = new Map<string, { expiresAt: number; stream$: Observable<unknown> }>();

  constructor(
    private readonly http: HttpClient,
    private readonly auditCache: LeaveAuditCacheService
  ) {}

  getLeaves(): Observable<LeaveRecord[]> {
    return this.cachedGet('leaves:all', () =>
      this.http.get<{ content: LeaveRecord[] }>(this.apiUrl).pipe(
        map((response) => response.content ?? []),
        tap((leaves) => this.cacheLeaveIds(leaves))
      )
    );
  }

  getLeavesByUsername(username: string): Observable<LeaveRecord[]> {
    const normalizedUsername = username.trim().toLowerCase();
    return this.cachedGet(`leaves:user:${normalizedUsername}`, () =>
      this.http.get<{ content: LeaveRecord[] }>(
        `${this.apiUrl}/by-username/${encodeURIComponent(username)}?size=200`
      ).pipe(
        map((response) => response.content ?? []),
        tap((leaves) => this.cacheLeaveIds(leaves))
      )
    );
  }

  getLeavesByManagerUsername(managerUsername: string): Observable<LeaveRecord[]> {
    const normalizedUsername = managerUsername.trim().toLowerCase();
    return this.cachedGet(`leaves:manager:${normalizedUsername}`, () =>
      this.http.get<{ content: LeaveRecord[] }>(
        `${this.apiUrl}/by-manager/${encodeURIComponent(managerUsername)}?size=200`
      ).pipe(
        map((response) => response.content ?? []),
        tap((leaves) => this.cacheLeaveIds(leaves))
      )
    );
  }

  getLeaveTypes(): Observable<LeaveType[]> {
    return this.cachedGet('leave-types', () =>
      this.http.get<LeaveType[]>(`${this.apiUrl}/types`)
    );
  }

  getNotifyUsers(username: string): Observable<NotifyUser[]> {
    const normalizedUsername = username.trim().toLowerCase();
    return this.cachedGet(`notify-users:${normalizedUsername}`, () =>
      this.http.get<NotifyUser[]>(
        `${this.apiUrl}/notify-users?username=${encodeURIComponent(username)}`
      )
    );
  }

  getHolidays(year?: number): Observable<Holiday[]> {
    const url = year ? `${this.holidayUrl}?year=${year}` : this.holidayUrl;
    const cacheKey = year ? `holidays:${year}` : 'holidays:all';
    return this.cachedGet(cacheKey, () => this.http.get<Holiday[]>(url));
  }

  createHoliday(payload: CreateHolidayPayload): Observable<Holiday> {
    return this.http.post<Holiday>(this.holidayUrl, payload).pipe(
      this.invalidateOnSuccess('holidays:')
    );
  }

  updateHoliday(id: number, payload: CreateHolidayPayload): Observable<Holiday> {
    return this.http.put<Holiday>(`${this.holidayUrl}/${id}`, payload).pipe(
      this.invalidateOnSuccess('holidays:')
    );
  }

  deleteHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${this.holidayUrl}/${id}`).pipe(
      this.invalidateOnSuccess('holidays:')
    );
  }

  createLeave(payload: CreateLeavePayload): Observable<LeaveRecord> {
    return this.http.post<LeaveRecord>(this.apiUrl, {
      username: payload.username,
      leaveTypeId: payload.leaveTypeId,
      leaveDates: payload.leaveDates,
      reason: payload.reason,
      comments: payload.comments,
      notifyUserIds: payload.notifyUserIds ?? []
    }).pipe(this.invalidateLeaveReadsOnSuccess());
  }

  updateLeave(leaveId: number, payload: UpdateLeavePayload): Observable<LeaveRecord> {
    return this.http.put<LeaveRecord>(`${this.apiUrl}/${leaveId}`, {
      leaveTypeId: payload.leaveTypeId,
      leaveDates: payload.leaveDates,
      reason: payload.reason,
      comments: payload.comments,
      notifyUserIds: payload.notifyUserIds ?? []
    }).pipe(this.invalidateLeaveReadsOnSuccess());
  }

  deleteLeave(leaveId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${leaveId}`).pipe(
      this.invalidateLeaveReadsOnSuccess()
    );
  }

  updateLeaveStatus(leaveId: number, payload: UpdateLeaveStatusPayload): Observable<LeaveRecord> {
    return this.http.put<LeaveRecord>(`${this.apiUrl}/${leaveId}/status`, {
      actorUsername: payload.actorUsername,
      status: payload.status,
      rejectionReason: payload.rejectionReason ?? null
    }).pipe(this.invalidateLeaveReadsOnSuccess());
  }

  reviewLeaveFromMail(leaveId: number, payload: MailLeaveDecisionPayload): Observable<LeaveRecord> {
    return this.http.post<LeaveRecord>(`${this.apiUrl}/${leaveId}/mail-decision`, {
      actorUsername: payload.actorUsername,
      decision: payload.decision,
      rejectionReason: payload.rejectionReason ?? null
    }).pipe(this.invalidateLeaveReadsOnSuccess());
  }

  applyPartialStatus(leaveId: number, payload: PartialLeaveStatusPayload): Observable<LeaveRecord> {
    return this.http.put<LeaveRecord>(`${this.apiUrl}/${leaveId}/partial-status`, {
      actorUsername: payload.actorUsername,
      dateDecisions: payload.dateDecisions,
      rejectionReason: payload.rejectionReason ?? null
    }).pipe(this.invalidateLeaveReadsOnSuccess());
  }

  createLeaveType(payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.post<LeaveType>(`${this.apiUrl}/types`, this.buildLeaveTypeBody(payload)).pipe(
      this.invalidateOnSuccess('leave-types')
    );
  }

  updateLeaveType(leaveTypeId: number, payload: CreateLeaveTypePayload): Observable<LeaveType> {
    return this.http.put<LeaveType>(`${this.apiUrl}/types/${leaveTypeId}`, this.buildLeaveTypeBody(payload)).pipe(
      this.invalidateOnSuccess('leave-types')
    );
  }

  private buildLeaveTypeBody(payload: CreateLeaveTypePayload) {
    return {
      leaveName: payload.leaveName.trim(),
      leaveUniqueName: payload.leaveUniqueName.trim(),
      description: payload.description.trim(),
      maxDays: payload.maxDays,
      genderRestriction: payload.genderRestriction || null
    };
  }

  deleteLeaveType(leaveTypeId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/types/${leaveTypeId}`).pipe(
      this.invalidateOnSuccess('leave-types')
    );
  }

  getBookedDates(username: string): Observable<string[]> {
    const normalizedUsername = username.trim().toLowerCase();
    return this.cachedGet(`booked-dates:${normalizedUsername}`, () =>
      this.http.get<string[]>(
        `${this.apiUrl}/booked-dates/${encodeURIComponent(username)}`
      )
    );
  }

  private cachedGet<T>(key: string, requestFactory: () => Observable<T>): Observable<T> {
    const now = Date.now();
    const cachedEntry = this.responseCache.get(key);

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return cachedEntry.stream$ as Observable<T>;
    }

    const stream$ = requestFactory().pipe(
      shareReplay({ bufferSize: 1, refCount: false, windowTime: this.cacheTtlMs })
    );

    this.responseCache.set(key, {
      stream$,
      expiresAt: now + this.cacheTtlMs
    });

    return stream$;
  }

  private invalidateCache(prefix: string): void {
    for (const key of this.responseCache.keys()) {
      if (key === prefix || key.startsWith(prefix)) {
        this.responseCache.delete(key);
      }
    }
  }

  private invalidateOnSuccess(prefix: string) {
    return <T>(source: Observable<T>) =>
      new Observable<T>((observer) =>
        source.subscribe({
          next: (value) => {
            this.invalidateCache(prefix);
            observer.next(value);
          },
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        })
      );
  }

  private invalidateLeaveReadsOnSuccess() {
    return <T>(source: Observable<T>) =>
      new Observable<T>((observer) =>
        source.subscribe({
          next: (value) => {
            this.invalidateCache('leaves:');
            this.invalidateCache('booked-dates:');
            observer.next(value);
          },
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        })
      );
  }


  private cacheLeaveIds(leaves: LeaveRecord[]): void {
    if (!leaves || !Array.isArray(leaves)) {
      return;
    }

    leaves.forEach(leave => {
      if (leave.id && leave.trail) {
        this.auditCache.addLeaveToCache(leave.id);
      }
    });
  }

}
