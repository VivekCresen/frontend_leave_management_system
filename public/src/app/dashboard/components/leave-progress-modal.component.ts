import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminLeaveTableRow } from './dashboard-leave-table.component';

export type LeaveProgressStep = {
  label: string;
  sublabel: string;
  status: 'done' | 'active' | 'pending' | 'rejected';
  icon: string;
};

@Component({
  selector: 'app-leave-progress-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './leave-progress-modal.component.html',
  styleUrls: ['./leave-progress-modal.component.css']
})
export class LeaveProgressModalComponent {
  @Input({ required: true }) leave!: AdminLeaveTableRow;
  @Output() closed = new EventEmitter<void>();

  get steps(): LeaveProgressStep[] {
    const s = this.leave.status;
    const isRejected = s === 'REJECTED';
    const isManagerApproved = s === 'MANAGER_APPROVED' || s === 'APPROVED';
    const isAdminApproved = s === 'APPROVED';

    // Determine where rejection happened (manager or admin level)
    const rejectedAtManager = isRejected && !this.leave.managerApprovedBy;
    const rejectedAtAdmin = isRejected && !!this.leave.managerApprovedBy;

    return [
      {
        label: 'Submitted',
        sublabel: 'Leave request created',
        status: 'done',
        icon: 'fa-paper-plane'
      },
      {
        label: 'Manager Review',
        sublabel: isManagerApproved
          ? `Approved by ${this.leave.managerApprovedBy ?? this.leave.approvedBy ?? 'Manager'}`
          : rejectedAtManager
          ? `Rejected — ${this.leave.rejectionReason ?? 'No reason given'}`
          : 'Awaiting manager approval',
        status: isManagerApproved ? 'done' : rejectedAtManager ? 'rejected' : 'active',
        icon: isManagerApproved ? 'fa-circle-check' : rejectedAtManager ? 'fa-circle-xmark' : 'fa-user-tie'
      },
      {
        label: 'Admin Review',
        sublabel: isAdminApproved
          ? `Approved by ${this.leave.approvedBy ?? 'Admin'}`
          : rejectedAtAdmin
          ? `Rejected — ${this.leave.rejectionReason ?? 'No reason given'}`
          : isManagerApproved
          ? 'Awaiting admin final approval'
          : 'Pending manager approval first',
        status: isAdminApproved ? 'done' : rejectedAtAdmin ? 'rejected' : isManagerApproved ? 'active' : 'pending',
        icon: isAdminApproved ? 'fa-circle-check' : rejectedAtAdmin ? 'fa-circle-xmark' : 'fa-user-shield'
      },
      {
        label: isRejected ? 'Rejected' : isAdminApproved ? 'Approved' : 'Final Decision',
        sublabel: isRejected
          ? (this.leave.rejectionReason ?? 'Request was rejected')
          : isAdminApproved
          ? 'Leave is fully approved'
          : 'Awaiting final decision',
        status: isAdminApproved ? 'done' : isRejected ? 'rejected' : 'pending',
        icon: isAdminApproved ? 'fa-calendar-check' : isRejected ? 'fa-ban' : 'fa-hourglass-half'
      }
    ];
  }

  get progressPercent(): number {
    const s = this.leave.status;
    if (s === 'APPROVED') return 100;
    if (s === 'MANAGER_APPROVED') return 66;
    if (s === 'REJECTED') return this.leave.managerApprovedBy ? 66 : 33;
    return 10; // PENDING
  }

  get statusColor(): string {
    const s = this.leave.status;
    if (s === 'APPROVED') return '#0f8b8d';
    if (s === 'REJECTED') return '#dc2626';
    if (s === 'MANAGER_APPROVED') return '#f59e0b';
    return '#64748b';
  }
}
