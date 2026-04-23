import { inject, InjectionToken, Signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
  email: string;
  role: string;
  active: boolean;
  token: string;
  message: string;
}

export interface ManagedUser {
  id: number;
  companyId: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  gender: string;
  createdBy: string;
  updatedBy: string;
  createDate: string | null;
  updateDate: string | null;
  lastLogin: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserDashboardResponse {
  actor: ManagedUser;
  users: ManagedUser[];
  assignableRoles: string[];
  canManageUsers: boolean;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminCount: number;
  managerCount: number;
  employeeCount: number;
}

export interface UserManagementPayload {
  companyId: string;
  fullName: string;
  username: string;
  email: string;
  password?: string;
  role: string;
  managerUsername?: string;
  active: boolean;
  gender: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string>;
}

export interface ImportUsersResult {
  message: string;
  imported: number;
}

export interface AuthService {
  readonly currentUser: Signal<LoginResponse | null>;
  login(payload: LoginRequest): Observable<LoginResponse>;
  getDashboard(): Observable<UserDashboardResponse>;
  createUser(payload: UserManagementPayload): Observable<ManagedUser>;
  updateUser(userId: number, payload: UserManagementPayload): Observable<ManagedUser>;
  updateProfile(userId: number, fullName: string, gender: string): Observable<ManagedUser>;
  deleteUser(userId: number): Observable<void>;
  requestResetOtp(email: string): Observable<MessageResponse>;
  verifyOtp(email: string, otp: string): Observable<MessageResponse>;
  resetPassword(email: string, otp: string, newPassword: string): Observable<LoginResponse>;
  setCurrentUser(user: LoginResponse): void;
  clearCurrentUser(): void;
  downloadImportTemplate(): Observable<Blob>;
  importUsersFromExcel(file: File): Observable<ImportUsersResult>;
}

export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');

export function injectAuthService(): AuthService {
  return inject(AUTH_SERVICE);
}
