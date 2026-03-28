import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import {
  DashboardUserFormComponent,
  DashboardUserSubmitEvent
} from '../components/dashboard-user-form.component';
import { DashboardUserTableComponent } from '../components/dashboard-user-table.component';
import { LoginResponse, ManagedUser, UserDashboardResponse } from '../../services/auth.service';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DashboardStatCardsComponent,
    DashboardUserFormComponent,
    DashboardUserTableComponent
  ],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() cancelEditRequested = new EventEmitter<void>();

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'My employees',
        value: this.dashboard?.employeeCount ?? 0,
        note: 'Assigned to this manager.',
        tone: 'teal'
      },
      {
        label: 'Active team',
        value: this.dashboard?.activeUsers ?? 0,
        note: 'Currently active.',
        tone: 'orange'
      },
      {
        label: 'Inactive team',
        value: this.dashboard?.inactiveUsers ?? 0,
        note: 'Need follow-up.',
        tone: 'slate'
      },
      {
        label: 'My role',
        value: 'Manager',
        note: 'Employee management access.',
        tone: 'orange'
      }
    ];
  }
}
