import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminLeaveTableRow } from '../components/dashboard-leave-table.component';
import { LeaveType } from '../../services/leave.service';
import { ToastService } from '../../services/toast.service';

export interface LeaveFormSubmitEvent {
  leaveTypeId: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
}

type LeaveFormModel = {
  leaveTypeId: number | null;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
};

@Component({
  selector: 'app-dashboard-leave-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-leave-form.component.html',
  styleUrls: ['./dashboard-leave-form.component.css']
})
export class DashboardLeaveFormComponent implements OnChanges {
  @Input({ required: true }) leaveTypes: LeaveType[] = [];
  @Input() userGender: string | null = null;
  @Input() myLeaves: AdminLeaveTableRow[] = [];
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelRequested = new EventEmitter<void>();

  @ViewChild('leaveForm') private leaveForm?: NgForm;

  submitted = false;
  model: LeaveFormModel = this.createDefaultModel();

  constructor(private readonly toast: ToastService) {}

  get availableLeaveTypes(): LeaveType[] {
    if (!this.userGender) return this.leaveTypes;
    const gender = this.userGender.toUpperCase();
    return this.leaveTypes.filter(
      (lt) => !lt.genderRestriction || lt.genderRestriction === gender
    );
  }

  get genderRestrictedCount(): number {
    if (!this.userGender) return 0;
    const gender = this.userGender.toUpperCase();
    return this.leaveTypes.filter(
      (lt) => lt.genderRestriction && lt.genderRestriction !== gender
    ).length;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userGender'] && !changes['userGender'].firstChange && this.genderRestrictedCount > 0) {
      const count = this.genderRestrictedCount;
      this.toast.info(`${count} leave type${count === 1 ? ' is' : 's are'} not available for your gender.`);
    }
  }

  onLeaveTypeChange(): void {
    const lt = this.selectedLeaveType;
    if (!lt) return;

    if (lt.description) {
      this.toast.info(lt.description);
    }

    if (lt.genderRestriction) {
      const label = lt.genderRestriction === 'MALE' ? 'Male' : 'Female';
      this.toast.info(`${lt.leaveName} is restricted to ${label} employees only.`);
    }
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get minToDate(): string {
    return this.model.fromDate || this.today;
  }

  get durationDays(): number {
    if (!this.model.fromDate || !this.model.toDate) return 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    if (to < from) return 0;

    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  get totalCalendarDays(): number {
    if (!this.model.fromDate || !this.model.toDate) return 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  }

  get weekendDaysCount(): number {
    return this.totalCalendarDays - this.durationDays;
  }

  get selectedLeaveType(): LeaveType | null {
    return this.leaveTypes.find((lt) => lt.id === this.model.leaveTypeId) ?? null;
  }

  get dateRangeError(): string | null {
    if (!this.submitted) return null;
    if (!this.model.fromDate) return 'Start date is required';
    if (!this.model.toDate) return 'End date is required';
    if (new Date(this.model.toDate) < new Date(this.model.fromDate)) {
      return 'End date must be on or after start date';
    }
    return null;
  }

  getFieldError(field: string): string | null {
    return this.fieldErrors[field] ?? null;
  }

  get exceedsMaxDays(): boolean {
    const lt = this.selectedLeaveType;
    return !!lt && this.durationDays > lt.maxDays;
  }

  get hasPendingOfSameType(): boolean {
    const lt = this.selectedLeaveType;
    if (!lt) return false;
    return this.myLeaves.some(
      (l) => l.status === 'PENDING' && l.leaveType.trim().toLowerCase() === lt.leaveName.trim().toLowerCase()
    );
  }

  submit(form: NgForm): void {
    this.submitted = true;

    if (form.invalid || this.dateRangeError) {
      return;
    }

    const leaveType = this.selectedLeaveType;
    if (!leaveType || !this.model.leaveTypeId) return;

    if (this.exceedsMaxDays) {
      this.toast.warn(
        `Selected duration (${this.durationDays} days) exceeds the maximum allowed ${leaveType.maxDays} days for ${leaveType.leaveName}.`
      );
      return;
    }

    if (this.hasPendingOfSameType) {
      this.toast.warn(
        `You already have a pending ${leaveType.leaveName} request. Please wait for it to be processed before submitting another.`
      );
      return;
    }

    this.saveRequested.emit({
      leaveTypeId: this.model.leaveTypeId,
      leaveType: leaveType.leaveName,
      fromDate: this.model.fromDate,
      toDate: this.model.toDate,
      reason: this.model.reason.trim(),
      comments: this.model.comments.trim()
    });
  }

  cancel(): void {
    this.cancelRequested.emit();
    this.reset();
  }

  reset(): void {
    this.submitted = false;
    this.model = this.createDefaultModel();
    this.leaveForm?.resetForm(this.model);
  }

  onFromDateChange(): void {
    if (this.model.toDate && this.model.toDate < this.model.fromDate) {
      this.model.toDate = this.model.fromDate;
    }
  }

  private createDefaultModel(): LeaveFormModel {
    return {
      leaveTypeId: null,
      fromDate: '',
      toDate: '',
      reason: '',
      comments: ''
    };
  }
}
