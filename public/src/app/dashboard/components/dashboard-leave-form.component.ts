import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { LeaveType } from '../../services/leave.service';

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
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelRequested = new EventEmitter<void>();

  @ViewChild('leaveForm') private leaveForm?: NgForm;

  submitted = false;
  model: LeaveFormModel = this.createDefaultModel();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fieldErrors']) {
      // field errors updated from parent
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
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
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

  submit(form: NgForm): void {
    this.submitted = true;

    if (form.invalid || this.dateRangeError) {
      return;
    }

    const leaveType = this.selectedLeaveType;
    if (!leaveType || !this.model.leaveTypeId) return;

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
