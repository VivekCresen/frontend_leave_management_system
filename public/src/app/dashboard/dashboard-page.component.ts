import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import {
  ApiErrorResponse,
  LoginResponse,
  ManagedUser,
  UserManagementPayload,
  UserDashboardResponse
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
    FormsModule,
    TitleCasePipe,
    AdminDashboardComponent,
    ManagerDashboardComponent,
    EmployeeDashboardComponent
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit, OnChanges {
  private readonly authService: AuthApiService;
  private readonly usernameRegex = /^[A-Za-z0-9._-]+$/;

  readonly genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  readonly usernameMinLength = 3;
  readonly usernameMaxLength = 100;

  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;

  dashboard: UserDashboardResponse | null = null;
  editingUser: ManagedUser | null = null;
  isUserFormOpen = false;
  fieldErrors: Record<string, string> = {};
  errorMessage = '';
  isLoading = false;
  isSaving = false;
  isProfileMenuOpen = false;
  isProfileModalOpen = false;
  isProfileSaving = false;
  profileSubmitted = false;
  profileFieldErrors: Record<string, string> = {};
  profileModel = this.createProfileModel();

  constructor(
    authService: AuthApiService,
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    this.authService = authService;
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && !changes['user'].firstChange) {
      this.loadDashboard();
    }

    if (changes['user'] && !this.isProfileModalOpen) {
      this.syncProfileModel();
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
        overview: 'Dashboard summary',
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

  get profileDisplayName(): string {
    return this.dashboard?.actor?.fullName?.trim() || this.user.username;
  }

  get profileDisplayEmail(): string {
    return this.dashboard?.actor?.email?.trim() || this.user.email;
  }

  get profileInitials(): string {
    const source = this.profileDisplayName.trim() || this.user.username.trim() || 'User';
    const parts = source.split(/\s+/).filter((value) => value.length > 0);
    const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (initials || source.slice(0, 2)).toUpperCase();
  }

  get profileRoleLabel(): string {
    return this.user.role ? this.user.role.toLowerCase() : 'employee';
  }

  @HostListener('document:click')
  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.isProfileMenuOpen = false;

    if (this.isProfileModalOpen && !this.isProfileSaving) {
      this.closeProfileEditor();
    }
  }

  refresh(): void {
    this.loadDashboard();
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  openProfileEditor(): void {
    this.isProfileMenuOpen = false;
    this.profileFieldErrors = {};
    this.profileSubmitted = false;
    this.syncProfileModel();
    this.isProfileModalOpen = true;
  }

  closeProfileEditor(): void {
    this.isProfileModalOpen = false;
    this.isProfileSaving = false;
    this.profileSubmitted = false;
    this.profileFieldErrors = {};
    this.syncProfileModel();
  }

  resetProfileForm(): void {
    this.profileFieldErrors = {};
    this.profileSubmitted = false;
    this.syncProfileModel();
  }

  openChangePassword(): void {
    this.isProfileMenuOpen = false;
    this.router.navigate(['/change-password']);
  }

  openForgotPassword(): void {
    this.isProfileMenuOpen = false;
    this.router.navigate(['/forgot-password']);
  }

  logout(): void {
    this.isProfileMenuOpen = false;
    this.authService.clearCurrentUser();
    this.toastService.info('Logged out successfully');
    this.router.navigate(['/login']);
  }

  saveProfile(form: NgForm): void {
    const actor = this.dashboard?.actor;
    if (!actor) {
      this.toastService.error('Profile details are not available yet.');
      return;
    }

    this.profileSubmitted = true;
    this.normalizeProfileModel();

    if (form.invalid || !!this.getProfileUsernameMessage()) {
      return;
    }

    this.isProfileSaving = true;
    this.profileFieldErrors = {};

    this.authService.updateUser(actor.id, this.buildProfilePayload(actor)).subscribe({
      next: (updatedUser) => {
        this.isProfileSaving = false;
        this.isProfileModalOpen = false;
        this.profileSubmitted = false;
        this.profileFieldErrors = {};
        this.authService.setCurrentUser({
          ...this.user,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          active: updatedUser.active
        });
        this.toastService.success('Profile updated successfully');
        this.loadDashboard();
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isProfileSaving = false;
        this.profileFieldErrors = err.error?.errors ?? {};
        this.toastService.error(err.error?.message || 'Unable to update your profile right now.');
      }
    });
  }

  openCreateForm(): void {
    this.fieldErrors = {};
    this.editingUser = null;
    this.isUserFormOpen = true;
  }

  startEdit(user: ManagedUser): void {
    this.fieldErrors = {};
    this.editingUser = user;
    this.isUserFormOpen = true;
  }

  cancelEdit(): void {
    this.fieldErrors = {};
    this.editingUser = null;
    this.isUserFormOpen = false;
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
        this.isUserFormOpen = false;
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

  getProfileControlError(
    control: NgModel | null,
    field: 'fullName' | 'username' | 'email' | 'gender',
    fallback: string
  ): string | null {
    if (this.profileFieldErrors[field]) {
      return this.profileFieldErrors[field];
    }

    if (field === 'username') {
      const usernameMessage = this.getProfileUsernameMessage();
      if (usernameMessage && this.shouldShowProfileError(control)) {
        return usernameMessage;
      }
    }

    if (!control || !this.shouldShowProfileError(control)) {
      return null;
    }

    if (control.errors?.['required']) {
      return fallback;
    }

    if (control.errors?.['email']) {
      return 'Enter a valid email address';
    }

    if (control.errors?.['maxlength']) {
      return `Maximum ${control.errors['maxlength'].requiredLength} characters allowed`;
    }

    return null;
  }

  private loadDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.getDashboard().subscribe({
      next: (response) => {
        this.isLoading = false;
        this.dashboard = response;
        this.syncEditingUser(response);
        if (!this.isProfileModalOpen) {
          this.syncProfileModel();
        }
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

  private createProfileModel() {
    return {
      fullName: '',
      username: '',
      email: '',
      gender: ''
    };
  }

  private syncProfileModel(): void {
    const actor = this.dashboard?.actor;
    this.profileModel = {
      fullName: actor?.fullName ?? '',
      username: actor?.username ?? this.user.username ?? '',
      email: actor?.email ?? this.user.email ?? '',
      gender: actor?.gender ?? ''
    };
  }

  private normalizeProfileModel(): void {
    this.profileModel = {
      ...this.profileModel,
      fullName: this.profileModel.fullName.trim(),
      username: this.profileModel.username.trim(),
      email: this.profileModel.email.trim().toLowerCase()
    };
  }

  private buildProfilePayload(actor: ManagedUser): UserManagementPayload {
    return {
      companyId: actor.companyId ?? '',
      fullName: this.profileModel.fullName,
      username: this.profileModel.username,
      email: this.profileModel.email,
      password: '',
      role: actor.role ?? this.user.role,
      active: actor.active !== false,
      gender: this.profileModel.gender
    };
  }

  private getProfileUsernameMessage(): string | null {
    const username = this.profileModel.username.trim();

    if (!username) {
      return null;
    }

    if (username.length < this.usernameMinLength || username.length > this.usernameMaxLength) {
      return `Username must be ${this.usernameMinLength} to ${this.usernameMaxLength} characters`;
    }

    if (!this.usernameRegex.test(username)) {
      return 'Username must use letters, numbers, dot, underscore, or hyphen only';
    }

    return null;
  }

  private shouldShowProfileError(control: NgModel | null): boolean {
    return control
      ? control.touched === true || control.dirty === true || this.profileSubmitted
      : this.profileSubmitted;
  }
}
