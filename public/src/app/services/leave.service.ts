import { inject, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface LeaveType {
  id: number;
  leaveName: string;
  leaveUniqueName: string;
  description: string | null;
  maxDays: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeaveRecord {
  id: number;
  userId: number;
  fullName: string | null;
  emailId: string | null;
  leaveTypeId: number | null;
  leaveType: string | null;
  fromDate: string;
  toDate: string;
  reason: string | null;
  comments: string | null;
  trail: string | null;
  editable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateLeaveTypePayload {
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
}

export interface LeaveTypeSavePayload {
  id?: number;
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
}

export interface LeaveApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  details: string[];
}

export interface LeaveService {
  getLeaves(): Observable<LeaveRecord[]>;
  getLeaveTypes(): Observable<LeaveType[]>;
  createLeaveType(payload: CreateLeaveTypePayload): Observable<LeaveType>;
  updateLeaveType(leaveTypeId: number, payload: CreateLeaveTypePayload): Observable<LeaveType>;
  deleteLeaveType(leaveTypeId: number): Observable<void>;
}

export const LEAVE_SERVICE = new InjectionToken<LeaveService>('LEAVE_SERVICE');

export function injectLeaveService(): LeaveService {
  return inject(LEAVE_SERVICE);
}
