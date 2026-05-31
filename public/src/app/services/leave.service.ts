import { inject, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface LeaveType {
  id: number;
  leaveName: string;
  leaveUniqueName: string;
  description: string | null;
  maxDays: number;
  genderRestriction: 'MALE' | 'FEMALE' | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeaveDate {
  date: string;       
  dayType: string;    
}

export interface LeaveRecord {
  id: number;
  userId: number;
  fullName: string | null;
  emailId: string | null;
  leaveTypeId: number | null;
  leaveType: string | null;
  leaveDates: LeaveDate[];
  reason: string | null;
  comments: string | null;
  trail: string | null;
  editable: boolean;
  status: string | null;
  approvedBy: string | null;
  managerApprovedBy: string | null;
  managerRejectedBy: string | null;
  managerApprovedAt: string | null;
  managerRejectedAt: string | null;
  adminApprovedBy: string | null;
  adminRejectedBy: string | null;
  adminApprovedAt: string | null;
  adminRejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  notifyUserIds: number[];
}

export interface UpdateLeaveStatusPayload {
  actorUsername: string;
  status: 'APPROVED' | 'REJECTED' | 'MANAGER_APPROVED';
  rejectionReason?: string;
}

export interface MailLeaveDecisionPayload {
  actorUsername: string;
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface DateDecision {
  date: string;
  dayType: string;
  status: 'APPROVED' | 'REJECTED';
}

export interface PartialLeaveStatusPayload {
  actorUsername: string;
  dateDecisions: DateDecision[];
  rejectionReason?: string;
}

export interface CreateLeavePayload {
  username: string;
  leaveTypeId: number;
  leaveType: string;
  leaveDates: LeaveDate[];
  reason: string;
  comments: string;
  notifyUserIds: number[];
}

export interface UpdateLeavePayload {
  leaveTypeId: number;
  leaveDates: LeaveDate[];
  reason: string;
  comments: string;
  notifyUserIds: number[];
}

export interface NotifyUser {
  id: number;
  fullName: string | null;
  emailId: string | null;
  role: string | null;
}

export interface CreateLeaveTypePayload {
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
  genderRestriction: string | null;
}

export interface LeaveTypeSavePayload {
  id?: number;
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
  genderRestriction: string | null;
}

export interface LeaveApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  details: string[];
}

export interface Holiday {
  id: number;
  name: string;
  date: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

export interface CreateHolidayPayload {
  name: string;
  date: string;
  description: string;
  createdBy: string;
}

export interface LeaveService {
  getLeaves(): Observable<LeaveRecord[]>;
  getLeavesByUsername(username: string): Observable<LeaveRecord[]>;
  getLeavesByManagerUsername(managerUsername: string): Observable<LeaveRecord[]>;
  getLeaveTypes(): Observable<LeaveType[]>;
  getNotifyUsers(username: string): Observable<NotifyUser[]>;
  getHolidays(year?: number): Observable<Holiday[]>;
  createHoliday(payload: CreateHolidayPayload): Observable<Holiday>;
  updateHoliday(id: number, payload: CreateHolidayPayload): Observable<Holiday>;
  deleteHoliday(id: number): Observable<void>;
  createLeave(payload: CreateLeavePayload): Observable<LeaveRecord>;
  updateLeave(leaveId: number, payload: UpdateLeavePayload): Observable<LeaveRecord>;
  deleteLeave(leaveId: number): Observable<void>;
  updateLeaveStatus(leaveId: number, payload: UpdateLeaveStatusPayload): Observable<LeaveRecord>;
  reviewLeaveFromMail(leaveId: number, payload: MailLeaveDecisionPayload): Observable<LeaveRecord>;
  applyPartialStatus(leaveId: number, payload: PartialLeaveStatusPayload): Observable<LeaveRecord>;
  createLeaveType(payload: CreateLeaveTypePayload): Observable<LeaveType>;
  updateLeaveType(leaveTypeId: number, payload: CreateLeaveTypePayload): Observable<LeaveType>;
  deleteLeaveType(leaveTypeId: number): Observable<void>;
  getBookedDates(username: string): Observable<string[]>;
}

export const LEAVE_SERVICE = new InjectionToken<LeaveService>('LEAVE_SERVICE');

export function injectLeaveService(): LeaveService {
  return inject(LEAVE_SERVICE);
}
