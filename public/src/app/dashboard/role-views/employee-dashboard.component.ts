import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import { LoginResponse, UserDashboardResponse } from '../../services/auth.service';
import { LeaveFormSubmitEvent } from '../components/dashboard-leave-form.component';
import { AdminLeaveTableRow } from '../components/dashboard-leave-table.component';
import { DashboardHistoryTableComponent } from '../components/dashboard-history-table.component';
import { LeaveType } from '../../services/leave.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DashboardStatCardsComponent,
    DashboardHistoryTableComponent
  ],
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})
export class EmployeeDashboardComponent {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() leaveTypes: LeaveType[] = [];
  @Input() isLeaveFormOpen = false;
  @Input() isSaving = false;
  @Input() leaveFieldErrors: Record<string, string> = {};
  @Input() myLeaves: AdminLeaveTableRow[] = [];

  @Output() openLeaveFormRequested = new EventEmitter<void>();
  @Output() leaveSubmitRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelLeaveFormRequested = new EventEmitter<void>();
  @Output() editProfileRequested = new EventEmitter<void>();

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Profile role',
        value: 'Employee',
        note: 'Standard user access.',
        tone: 'teal',
        icon: 'fa-id-badge',
        route: ['/dashboard', 'profile'],
        actionLabel: 'Open profile'
      },
      {
        label: 'Account status',
        value: this.user.active ? 'Active' : 'Inactive',
        note: 'Current account state.',
        tone: this.user.active ? 'orange' : 'slate',
        icon: 'fa-circle-dot',
        route: ['/dashboard', 'profile'],
        actionLabel: 'View account'
      },
      {
        label: 'Pending requests',
        value: this.pendingLeaves.length,
        note: 'Awaiting approval.',
        tone: 'orange',
        icon: 'fa-clock',
        route: ['/dashboard', 'requests'],
        actionLabel: 'View requests'
      },
      {
        label: 'Total requests',
        value: this.myLeaves.length,
        note: 'All submitted requests.',
        tone: 'slate',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'history'],
        actionLabel: 'View history'
      }
    ];
  }

  get pendingLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'PENDING');
  }

  get approvedLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'APPROVED');
  }

  get rejectedLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'REJECTED');
  }

  get leaveByType(): { type: string; count: number; pct: number }[] {
    const map = new Map<string, number>();
    for (const leave of this.myLeaves) {
      map.set(leave.leaveType, (map.get(leave.leaveType) ?? 0) + 1);
    }
    const total = this.myLeaves.length || 1;
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  get profileInitials(): string {
    const name = this.dashboard?.actor?.fullName?.trim() || this.user.username?.trim() || 'U';
    const parts = name.split(/\s+/).filter((p) => p.length > 0);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
  }
}
