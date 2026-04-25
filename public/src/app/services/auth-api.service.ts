import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AuthService,
  ImportUsersResult,
  LoginRequest,
  LoginResponse,
  ManagedUser,
  MessageResponse,
  UserDashboardResponse,
  UserManagementPayload
} from './auth.service';
import { resolveApiUrl } from '../shared/api-url.util';
import { TranslateService } from '../i18n/translate.service';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService implements AuthService {
  private readonly apiUrl = resolveApiUrl('__LEAVE_APP_API_URL__', 'leave-app-api-url', ':8081/api/users');
  private readonly storageKey = 'leave-app-user';
  private readonly currentUserState = signal<LoginResponse | null>(this.readStoredUser());

  readonly currentUser = this.currentUserState.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly translateService: TranslateService
  ) {
    // Restore language for any already-stored user (e.g. page refresh)
    const stored = this.currentUserState();
    if (stored?.username) {
      this.translateService.initForUser(stored.username);
    }
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      username: payload.username.trim(),
      password: payload.password
    });
  }

  getDashboard(): Observable<UserDashboardResponse> {
    return this.http.get<UserDashboardResponse>(`${this.apiUrl}/dashboard/${this.actorUsernameOrThrow()}`);
  }

  createUser(payload: UserManagementPayload): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(this.apiUrl, {
      actorUsername: this.actorUsernameOrThrow(),
      companyId: payload.companyId.trim(),
      fullName: payload.fullName.trim(),
      username: payload.username.trim(),
      email: this.normalizeEmail(payload.email),
      password: payload.password ?? '',
      role: payload.role.trim().toUpperCase(),
      managerUsername: payload.managerUsername?.trim() || null,
      active: payload.active,
      gender: payload.gender.trim()
    });
  }

  updateUser(userId: number, payload: UserManagementPayload): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${this.apiUrl}/${userId}`, {
      actorUsername: this.actorUsernameOrThrow(),
      companyId: payload.companyId.trim(),
      fullName: payload.fullName.trim(),
      username: payload.username.trim(),
      email: this.normalizeEmail(payload.email),
      password: (payload.password ?? '').trim(),
      role: payload.role.trim().toUpperCase(),
      active: payload.active,
      gender: payload.gender.trim()
    });
  }

  updateProfile(userId: number, fullName: string, gender: string): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.apiUrl}/${userId}/profile`, {
      actorUsername: this.actorUsernameOrThrow(),
      fullName: fullName.trim(),
      gender: gender.trim()
    });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${userId}?actorUsername=${encodeURIComponent(this.actorUsernameOrThrow())}`);
  }

  requestResetOtp(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password/request-otp`, {
      email: this.normalizeEmail(email)
    });
  }

  verifyOtp(email: string, otp: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/forgot-password/verify-otp`, {
      email: this.normalizeEmail(email),
      otp: otp.trim()
    });
  }

  resetPassword(email: string, otp: string, newPassword: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/forgot-password/reset`, {
      email: this.normalizeEmail(email),
      otp: otp.trim(),
      newPassword
    });
  }

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/import/template`, { responseType: 'blob' });
  }

  importUsersFromExcel(file: File): Observable<ImportUsersResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('actorUsername', this.actorUsernameOrThrow());
    // Must use responseType: 'blob' so Angular never tries to JSON-parse
    // a binary Excel error response. On success we parse the blob as JSON manually.
    return new Observable(observer => {
      this.http.post(`${this.apiUrl}/import`, formData, {
        responseType: 'blob',
        observe: 'response'
      }).subscribe({
        next: async (response) => {
          try {
            const text = await response.body!.text();
            const json = JSON.parse(text) as ImportUsersResult;
            observer.next(json);
            observer.complete();
          } catch {
            observer.error({ status: 0, error: { message: 'Unexpected response format.' } });
          }
        },
        error: (err) => {
          // Pass the blob through so the component can trigger download
          observer.error({ status: err.status, error: err.error, headers: err.headers });
        }
      });
    });
  }

  setCurrentUser(user: LoginResponse): void {
    const normalizedUser = this.normalizeUser(user);
    this.currentUserState.set(normalizedUser);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(normalizedUser));
    }
    this.translateService.initForUser(normalizedUser.username);
  }

  clearCurrentUser(): void {
    this.currentUserState.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this.translateService.resetForLogout();
  }

  private readStoredUser(): LoginResponse | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawValue = localStorage.getItem(this.storageKey);
    if (!rawValue) {
      return null;
    }

    try {
      return this.normalizeUser(JSON.parse(rawValue) as Partial<LoginResponse>);
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private actorUsernameOrThrow(): string {
    const actor = this.currentUserState();
    if (!actor?.username) {
      throw new Error('No logged in user found.');
    }

    return actor.username;
  }

  private normalizeUser(user: Partial<LoginResponse>): LoginResponse {
    const tokenClaims = this.decodeTokenClaims(user.token);
    const tokenUsername = this.stringClaim(tokenClaims?.['sub']);
    const tokenEmail = this.stringClaim(tokenClaims?.['email']);
    const tokenRole = this.stringClaim(tokenClaims?.['role']);
    const tokenActive = this.booleanClaim(tokenClaims?.['active']);

    return {
      username: user.username ?? tokenUsername,
      email: user.email ?? tokenEmail,
      role: user.role ?? tokenRole,
      active: user.active ?? tokenActive ?? true,
      token: user.token ?? '',
      message: user.message ?? ''
    };
  }

  private decodeTokenClaims(token: string | undefined): Record<string, unknown> | null {
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const decoded = atob(normalized);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private stringClaim(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private booleanClaim(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }
}
