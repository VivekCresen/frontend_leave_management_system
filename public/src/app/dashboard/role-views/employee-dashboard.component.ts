import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import { LoginResponse, UserDashboardResponse } from '../../services/auth.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardStatCardsComponent],
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})
export class EmployeeDashboardComponent {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Profile role',
        value: 'Employee',
        note: 'Standard user access.',
        tone: 'teal'
      },
      {
        label: 'Account status',
        value: this.user.active ? 'Active' : 'Inactive',
        note: 'Current account state.',
        tone: this.user.active ? 'orange' : 'slate'
      },
      {
        label: 'Managed by',
        value: this.dashboard?.actor?.createdBy || 'System',
        note: 'Recorded owner.',
        tone: 'slate'
      },
      {
        label: 'Security',
        value: 'Protected',
        note: 'Password can be updated.',
        tone: 'orange'
      }
    ];
  }
}
