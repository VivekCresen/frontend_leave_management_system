import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import { LoginResponse, UserDashboardResponse } from '../../services/auth.service';
import { DashboardLeaveFormComponent, LeaveFormSubmitEvent } from '../components/dashboard-leave-form.component';
import { CreateLeavePayload, LeaveType } from '../../services/leave.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, DashboardStatCardsComponent, DashboardLeaveFormComponent],
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

  @Output() openLeaveFormRequested = new EventEmitter<void>();
  @Output() leaveSubmitRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelLeaveFormRequested = new EventEmitter<void>();

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Profile role',
        value: 'Employee',
        note: 'Standard user access.',
        tone: 'teal',
        route: ['/dashboard', 'profile'],
        actionLabel: 'Open profile'
      },
      {
        label: 'Account status',
        value: this.user.active ? 'Active' : 'Inactive',
        note: 'Current account state.',
        tone: this.user.active ? 'orange' : 'slate',
        route: ['/dashboard', 'profile'],
        actionLabel: 'View account'
      },
      {
        label: 'Managed by',
        value: this.dashboard?.actor?.createdBy || 'System',
        note: 'Assigned manager.',
        tone: 'slate',
        route: ['/dashboard', 'profile'],
        actionLabel: 'View details'
      },
      {
        label: 'Security',
        value: 'Protected',
        note: 'Password can be updated.',
        tone: 'orange',
        route: ['/dashboard', 'profile'],
        actionLabel: 'Manage profile'
      }
    ];
  }
}
