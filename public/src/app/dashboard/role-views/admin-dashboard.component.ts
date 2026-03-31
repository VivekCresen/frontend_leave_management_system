import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import {
  DashboardUserFormComponent,
  DashboardUserSubmitEvent
} from '../components/dashboard-user-form.component';
import { DashboardUserTableComponent } from '../components/dashboard-user-table.component';
import { LoginResponse, ManagedUser, UserDashboardResponse } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardStatCardsComponent,
    DashboardUserFormComponent,
    DashboardUserTableComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() isUserFormOpen = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() createRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() cancelEditRequested = new EventEmitter<void>();

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Total visible users',
        value: this.dashboard?.totalUsers ?? 0,
        note: 'All accounts in the directory.',
        tone: 'teal',
        icon: 'fa-users'
      },
      {
        label: 'Managers',
        value: this.dashboard?.managerCount ?? 0,
        note: 'Active management layer.',
        tone: 'orange',
        icon: 'fa-user-tie'
      },
      {
        label: 'Employees',
        value: this.dashboard?.employeeCount ?? 0,
        note: 'Employee accounts.',
        tone: 'slate',
        icon: 'fa-id-badge'
      },
      {
        label: 'Inactive accounts',
        value: this.dashboard?.inactiveUsers ?? 0,
        note: 'Require review.',
        tone: 'orange',
        icon: 'fa-user-slash'
      }
    ];
  }

  get assignableRoles(): string[] {
    return (this.dashboard?.assignableRoles ?? []).filter((role) => role !== 'ADMIN');
  }
}
