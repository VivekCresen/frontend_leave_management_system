import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import {
  ApiErrorResponse,
  LoginResponse,
  ManagedUser,
  UserDashboardResponse,
  injectAuthService
} from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import {
  DashboardPageId,
  normalizeDashboardRole
} from './dashboard.config';
import { AdminDashboardComponent } from './role-views/admin-dashboard.component';
import { EmployeeDashboardComponent } from './role-views/employee-dashboard.component';
import { ManagerDashboardComponent } from './role-views/manager-dashboard.component';
import { DashboardUserSubmitEvent } from './components/dashboard-user-form.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    AdminDashboardComponent,
    ManagerDashboardComponent,
    EmployeeDashboardComponent
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit, OnChanges {
  private readonly authService = injectAuthService();

  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;

  dashboard: UserDashboardResponse | null = null;
  editingUser: ManagedUser | null = null;
  fieldErrors: Record<string, string> = {};
  errorMessage = '';
  isLoading = false;
  isSaving = false;

  constructor(private readonly toastService: ToastService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && !changes['user'].firstChange) {
      this.loadDashboard();
    }
  }

  get normalizedRole(): 'ADMIN' | 'MANAGER' | 'EMPLOYEE' {
    return normalizeDashboardRole(this.user.role);
  }

  get pageHeading(): string {
    return (
      {
        overview: 'Overview',
        users: 'User Management',
        roles: 'Roles And Access',
        leaves: 'Leave Operations',
        reports: 'Reports',
        settings: 'Settings',
        team: 'Team Members',
        approvals: 'Approvals',
        calendar: 'Calendar',
        profile: 'My Profile',
        requests: 'Leave Requests',
        history: 'History'
      } satisfies Record<DashboardPageId, string>
    )[this.pageId];
  }

  get pageDescription(): string {
    return (
      {
        overview: 'Live dashboard summary for the current role.',
        users: 'Manage user accounts.',
        roles: 'Review access structure.',
        leaves: 'Leave operations workspace.',
        reports: 'View account summary.',
        settings: 'Manage account controls.',
        team: 'Manage team accounts.',
        approvals: 'Approval workspace.',
        calendar: 'Calendar workspace.',
        profile: 'View profile details.',
        requests: 'Request workspace.',
        history: 'View request history.'
      } satisfies Record<DashboardPageId, string>
    )[this.pageId];
  }

  refresh(): void {
    this.loadDashboard();
  }

  startEdit(user: ManagedUser): void {
    this.fieldErrors = {};
    this.editingUser = user;
  }

  cancelEdit(): void {
    this.fieldErrors = {};
    this.editingUser = null;
  }

  handleSave(event: DashboardUserSubmitEvent): void {
    this.isSaving = true;
    this.fieldErrors = {};

    const request = event.userId
      ? this.authService.updateUser(event.userId, event.payload)
      : this.authService.createUser(event.payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.editingUser = null;
        this.toastService.success(event.userId ? 'User updated successfully' : 'User created successfully');
        this.loadDashboard();
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isSaving = false;
        this.fieldErrors = err.error?.errors ?? {};
        const message = err.error?.message || 'Unable to save the user right now.';
        this.toastService.error(message);
      }
    });
  }

  handleDelete(user: ManagedUser): void {
    if (!confirm(`Delete ${user.fullName}?`)) {
      return;
    }

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        if (this.editingUser?.id === user.id) {
          this.editingUser = null;
        }
        this.toastService.success('User deleted successfully');
        this.loadDashboard();
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.toastService.error(err.error?.message || 'Unable to delete the selected user.');
      }
    });
  }

  private loadDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.getDashboard().subscribe({
      next: (response) => {
        this.isLoading = false;
        this.dashboard = response;
        this.syncEditingUser(response);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.dashboard = null;
        this.errorMessage = err.error?.message || 'Unable to load dashboard data.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  private syncEditingUser(response: UserDashboardResponse): void {
    if (!this.editingUser) {
      return;
    }

    this.editingUser = response.users.find((user) => user.id === this.editingUser?.id) ?? null;
  }
}
