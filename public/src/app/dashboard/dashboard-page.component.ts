import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';import { AuthApiService } from '../services/auth-api.service';
import { LeaveApiService } from '../services/leave-api.service';
import {
  ApiErrorResponse,
  LoginResponse,
  ManagedUser,
  UserManagementPayload,
  UserDashboardResponse
} from '../services/auth.service';
import { CreateLeavePayload, LeaveApiErrorResponse, LeaveType, LeaveTypeSavePayload, UpdateLeaveStatusPayload, NotifyUser, Holiday, CreateHolidayPayload } from '../services/leave.service';
import { ToastService } from '../services/toast.service';
import {
  DashboardPageId,
  normalizeDashboardRole
} from './dashboard.config';
import { AdminDashboardComponent } from './role-views/admin-dashboard.component';
import { EmployeeDashboardComponent } from './role-views/employee-dashboard.component';
import { ManagerDashboardComponent } from './role-views/manager-dashboard.component';
import { DashboardUserSubmitEvent } from './components/dashboard-user-form.component';
import { AdminLeaveTableRow } from './components/dashboard-leave-table.component';
import { DashboardLeaveFormComponent, LeaveFormSubmitEvent } from './components/dashboard-leave-form.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminDashboardComponent,
    ManagerDashboardComponent,
    EmployeeDashboardComponent,
    DashboardLeaveFormComponent
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit, OnChanges {
  private readonly authService: AuthApiService;
  private readonly leaveService: LeaveApiService;
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
  leaveTypes: LeaveType[] = [];
  leaves: AdminLeaveTableRow[] = [];
  isLeaveTypesLoading = false;
  isLeavesLoading = false;
  isLeaveTypeSaving = false;
  leaveTypeFieldErrors: Record<string, string> = {};
  lastLeaveTypeCreatedAt = 0;
  profileSubmitted = false;
  profileFieldErrors: Record<string, string> = {};
  profileModel = this.createProfileModel();
  filterRole = '';
  filterStatus = '';
  isLeaveFormOpen = false;
  isLeaveSaving = false;
  leaveFieldErrors: Record<string, string> = {};
  editingLeave: AdminLeaveTableRow | null = null;
  managerLeaves: AdminLeaveTableRow[] = [];
  myLeaves: AdminLeaveTableRow[] = [];
  notifyUsers: NotifyUser[] = [];
  notifyUsersLoading = false;
  holidays: Holiday[] = [];
  isHolidaysLoading = false;

  constructor(
    authService: AuthApiService,
    leaveService: LeaveApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    this.authService = authService;
    this.leaveService = leaveService;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.filterRole = params['role'] ?? '';
      this.filterStatus = params['status'] ?? '';
    });
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

  openLeaveForm(leave: AdminLeaveTableRow | null = null): void {
    this.leaveFieldErrors = {};
    this.editingLeave = leave;
    this.notifyUsers = [];
    this.notifyUsersLoading = true;
    this.isLeaveFormOpen = true;
    this.leaveService.getNotifyUsers(this.user.username).subscribe({
      next: (users) => { this.notifyUsers = users; this.notifyUsersLoading = false; },
      error: () => { this.notifyUsers = []; this.notifyUsersLoading = false; }
    });
  }

  cancelLeaveForm(): void {
    this.isLeaveFormOpen = false;
    this.isLeaveSaving = false;
    this.leaveFieldErrors = {};
    this.editingLeave = null;
  }

  handleApproveLeave(leave: AdminLeaveTableRow): void {
    const payload: UpdateLeaveStatusPayload = {
      actorUsername: this.user.username,
      status: 'APPROVED'
    };

    this.leaveService.updateLeaveStatus(leave.id, payload).subscribe({
      next: (updated) => {
        this.updateLeaveInList(updated);
        this.toastService.success('Leave request approved');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to approve leave request.'));
      }
    });
  }

  handleRejectLeave(event: { leave: AdminLeaveTableRow; reason: string }): void {
    const payload: UpdateLeaveStatusPayload = {
      actorUsername: this.user.username,
      status: 'REJECTED',
      rejectionReason: event.reason
    };

    this.leaveService.updateLeaveStatus(event.leave.id, payload).subscribe({
      next: (updated) => {
        this.updateLeaveInList(updated);
        this.toastService.success('Leave request rejected');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to reject leave request.'));
      }
    });
  }

  handleCreateLeave(event: LeaveFormSubmitEvent): void {
    if (this.editingLeave) {
      this.handleUpdateLeave(event);
      return;
    }

    this.isLeaveSaving = true;
    this.leaveFieldErrors = {};

    // Group selections by session type → up to 3 separate requests:
    //   FULL days → one request
    //   MORNING half-days → one request
    //   AFTERNOON half-days → one request
    const groups: { dayType: string; dates: { date: string; dayType: string }[] }[] = [];

    const fullDates = event.daySelections
      .filter(s => s.session === 'FULL')
      .map(s => ({ date: s.date, dayType: 'FULL' }));
    if (fullDates.length) groups.push({ dayType: 'FULL', dates: fullDates });

    const morningDates = event.daySelections
      .filter(s => s.session === 'MORNING')
      .map(s => ({ date: s.date, dayType: 'MORNING_HALF' }));
    if (morningDates.length) groups.push({ dayType: 'MORNING_HALF', dates: morningDates });

    const afternoonDates = event.daySelections
      .filter(s => s.session === 'AFTERNOON')
      .map(s => ({ date: s.date, dayType: 'AFTERNOON_HALF' }));
    if (afternoonDates.length) groups.push({ dayType: 'AFTERNOON_HALF', dates: afternoonDates });

    if (groups.length === 0) {
      this.isLeaveSaving = false;
      this.toastService.warn('Select at least one leave day.');
      return;
    }

    const payloads: CreateLeavePayload[] = groups.map(g => ({
      username: this.user.username,
      leaveTypeId: event.leaveTypeId,
      leaveType: event.leaveType,
      leaveDates: g.dates,
      reason: event.reason,
      comments: event.comments,
      notifyUserIds: event.notifyUserIds
    }));

    from(payloads).pipe(
      concatMap(payload => this.leaveService.createLeave(payload)),
      toArray()
    ).subscribe({
      next: () => {
        this.isLeaveSaving = false;
        this.isLeaveFormOpen = false;
        this.editingLeave = null;
        const msg = payloads.length > 1
          ? `${payloads.length} leave requests submitted successfully`
          : 'Leave request submitted successfully';
        this.toastService.success(msg);
        this.loadDashboard();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeaveSaving = false;
        this.leaveFieldErrors = this.mapLeaveTypeErrors(err.error);
        this.toastService.error(
          this.buildLeaveTypeErrorMessage(err.error, 'Unable to submit leave request right now.')
        );
      }
    });
  }

  handleEditLeave(leave: AdminLeaveTableRow): void {
    if (!leave.editable || leave.status !== 'PENDING') {
      this.toastService.warn('Only pending leave requests can be edited.');
      return;
    }

    this.openLeaveForm(leave);
  }

  handleDeleteLeave(leave: AdminLeaveTableRow): void {
    if (!leave.editable || leave.status !== 'PENDING') {
      this.toastService.warn('Only pending leave requests can be deleted.');
      return;
    }

    if (!confirm(`Delete the ${leave.leaveType} leave request from ${leave.fromDate} to ${leave.toDate}?`)) {
      return;
    }

    this.leaveService.deleteLeave(leave.id).subscribe({
      next: () => {
        if (this.editingLeave?.id === leave.id) {
          this.cancelLeaveForm();
        }
        this.toastService.success('Leave request deleted successfully');
        this.loadDashboard();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to delete leave request right now.'));
      }
    });
  }

  private handleUpdateLeave(event: LeaveFormSubmitEvent): void {
    if (!this.editingLeave) {
      return;
    }

    this.isLeaveSaving = true;
    this.leaveFieldErrors = {};

    const leaveDates = event.daySelections.map((s) => ({
      date: s.date,
      dayType: s.session === 'FULL' ? 'FULL'
        : s.session === 'MORNING' ? 'MORNING_HALF'
        : 'AFTERNOON_HALF'
    }));

    this.leaveService.updateLeave(this.editingLeave.id, {
      leaveTypeId: event.leaveTypeId,
      leaveDates,
      reason: event.reason,
      comments: event.comments,
      notifyUserIds: event.notifyUserIds
    }).subscribe({
      next: () => {
        this.isLeaveSaving = false;
        this.isLeaveFormOpen = false;
        this.editingLeave = null;
        this.toastService.success('Leave request updated successfully');
        this.loadDashboard();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeaveSaving = false;
        this.leaveFieldErrors = this.mapLeaveTypeErrors(err.error);
        this.toastService.error(
          this.buildLeaveTypeErrorMessage(err.error, 'Unable to update leave request right now.')
        );
      }
    });
  }

  handleSaveLeaveType(payload: LeaveTypeSavePayload): void {
    this.isLeaveTypeSaving = true;
    this.leaveTypeFieldErrors = {};

    const request = payload.id
      ? this.leaveService.updateLeaveType(payload.id, payload)
      : this.leaveService.createLeaveType(payload);

    request.subscribe({
      next: (leaveType) => {
        this.isLeaveTypeSaving = false;
        this.leaveTypes = this.leaveTypes
          .filter((existingLeaveType) => existingLeaveType.id !== leaveType.id)
          .concat(leaveType)
          .sort((left, right) => left.id - right.id);
        this.lastLeaveTypeCreatedAt = Date.now();
        this.toastService.success(payload.id ? 'Leave type updated successfully' : 'Leave type created successfully');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeaveTypeSaving = false;
        this.leaveTypeFieldErrors = this.mapLeaveTypeErrors(err.error);
        const fallbackMessage = payload.id
          ? 'Unable to update the leave type right now.'
          : 'Unable to save the leave type right now.';
        const restartMessage = payload.id
          ? 'Update endpoint not found. Restart the leave service backend and try again.'
          : fallbackMessage;
        this.toastService.error(this.buildLeaveTypeErrorMessage(
          err.error,
          err.error?.status === 404 ? restartMessage : fallbackMessage
        ));
      }
    });
  }

  handleDeleteLeaveType(leaveType: LeaveType): void {
    if (!confirm(`Delete leave type "${leaveType.leaveName}"?`)) {
      return;
    }

    this.leaveService.deleteLeaveType(leaveType.id).subscribe({
      next: () => {
        this.leaveTypes = this.leaveTypes.filter((existingLeaveType) => existingLeaveType.id !== leaveType.id);
        this.toastService.success('Leave type deleted successfully');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.toastService.error(this.buildLeaveTypeErrorMessage(
          err.error,
          err.error?.status === 404
            ? 'Delete endpoint not found. Restart the leave service backend and try again.'
            : 'Unable to delete the leave type right now.'
        ));
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
        if (this.normalizedRole === 'ADMIN') {
          this.loadLeaves(response);
        }
        if (this.normalizedRole === 'MANAGER') {
          this.loadManagerLeaves(response);
        }
        if (this.normalizedRole === 'EMPLOYEE') {
          this.loadMyLeaves(response);
          // Pre-load notify users so the requests page shows them immediately
          this.leaveService.getNotifyUsers(this.user.username).subscribe({
            next: (users) => { this.notifyUsers = users; },
            error: () => { this.notifyUsers = []; }
          });
        }
        // Load leave types for all roles (needed for create leave form)
        this.loadLeaveTypes();
        this.loadHolidays();
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.dashboard = null;
        this.errorMessage = err.error?.message || 'Unable to load dashboard data.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  private loadLeaveTypes(): void {
    this.isLeaveTypesLoading = true;

    this.leaveService.getLeaveTypes().subscribe({
      next: (leaveTypes) => {
        this.isLeaveTypesLoading = false;
        this.leaveTypes = leaveTypes;
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeaveTypesLoading = false;
        this.leaveTypes = [];
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave types right now.'));
      }
    });
  }

  private loadHolidays(): void {
    this.isHolidaysLoading = true;
    this.leaveService.getHolidays().subscribe({
      next: (h) => { this.holidays = h; this.isHolidaysLoading = false; },
      error: () => { this.holidays = []; this.isHolidaysLoading = false; }
    });
  }

  handleCreateHoliday(payload: CreateHolidayPayload): void {
    this.leaveService.createHoliday({ ...payload, createdBy: this.user.username }).subscribe({
      next: (h) => { this.holidays = [...this.holidays, h].sort((a, b) => a.date.localeCompare(b.date)); this.toastService.success('Holiday created'); },
      error: (err: { error?: LeaveApiErrorResponse }) => this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to create holiday.'))
    });
  }

  handleUpdateHoliday(event: { id: number; payload: CreateHolidayPayload }): void {
    this.leaveService.updateHoliday(event.id, event.payload).subscribe({
      next: (h) => { this.holidays = this.holidays.map((x) => x.id === h.id ? h : x); this.toastService.success('Holiday updated'); },
      error: (err: { error?: LeaveApiErrorResponse }) => this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to update holiday.'))
    });
  }

  handleDeleteHoliday(id: number): void {
    if (!confirm('Delete this holiday?')) return;
    this.leaveService.deleteHoliday(id).subscribe({
      next: () => { this.holidays = this.holidays.filter((h) => h.id !== id); this.toastService.success('Holiday deleted'); },
      error: () => this.toastService.error('Unable to delete holiday.')
    });
  }

  private loadManagerLeaves(response: UserDashboardResponse): void {
    this.isLeavesLoading = true;

    this.leaveService.getLeavesByManagerUsername(this.user.username).subscribe({
      next: (leaves) => {
        this.isLeavesLoading = false;
        this.managerLeaves = leaves
          .map((leave) => {
            const dates = (leave.leaveDates ?? []).map(d => ({ ...d, date: this.toDateString(d.date) }));
            const fromDate = dates.map(d => this.toDateString(d.date)).sort()[0] ?? '';
            const toDate = dates.map(d => this.toDateString(d.date)).sort().reverse()[0] ?? '';
            return {
              id: leave.id,
              userId: leave.userId,
              leaveTypeId: leave.leaveTypeId,
              fullName: leave.fullName?.trim() || 'Unknown user',
              emailId: leave.emailId?.trim() || 'No email',
              role: response.users.find((u) => u.id === leave.userId)?.role ?? 'EMPLOYEE',
              leaveType: leave.leaveType?.trim() || 'Unassigned',
              leaveDates: dates,
              fromDate,
              toDate,
              reason: leave.reason?.trim() || '',
              comments: leave.comments?.trim() || '',
              createdAt: leave.createdAt,
              durationDays: this.calculateDurationDays(dates),
              status: leave.status ?? 'PENDING',
              approvedBy: leave.approvedBy ?? null,
              rejectionReason: leave.rejectionReason ?? null,
              notifyUserIds: leave.notifyUserIds ?? [],
              editable: leave.editable ?? false
            } satisfies AdminLeaveTableRow;
          })
          .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime());
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave records.'));
      }
    });
  }

  private loadMyLeaves(response: UserDashboardResponse): void {
    this.isLeavesLoading = true;

    this.leaveService.getLeavesByUsername(this.user.username).subscribe({
      next: (leaves) => {
        this.isLeavesLoading = false;
        this.myLeaves = leaves
          .map((leave) => {
            const dates = (leave.leaveDates ?? []).map(d => ({ ...d, date: this.toDateString(d.date) }));
            const fromDate = dates.map(d => this.toDateString(d.date)).sort()[0] ?? '';
            const toDate = dates.map(d => this.toDateString(d.date)).sort().reverse()[0] ?? '';
            return {
              id: leave.id,
              userId: leave.userId,
              leaveTypeId: leave.leaveTypeId,
              fullName: leave.fullName?.trim() || response.actor?.fullName || 'Me',
              emailId: leave.emailId?.trim() || response.actor?.email || '',
              role: 'EMPLOYEE',
              leaveType: leave.leaveType?.trim() || 'Unassigned',
              leaveDates: dates,
              fromDate,
              toDate,
              reason: leave.reason?.trim() || '',
              comments: leave.comments?.trim() || '',
              createdAt: leave.createdAt,
              durationDays: this.calculateDurationDays(dates),
              status: leave.status ?? 'PENDING',
              approvedBy: leave.approvedBy ?? null,
              rejectionReason: leave.rejectionReason ?? null,
              notifyUserIds: leave.notifyUserIds ?? [],
              editable: leave.editable ?? false
            } satisfies AdminLeaveTableRow;
          })
          .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime());
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        this.myLeaves = [];
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load your leave records.'));
      }
    });
  }

  private updateLeaveInList(updated: import('../services/leave.service').LeaveRecord): void {
    const patch = (row: AdminLeaveTableRow): AdminLeaveTableRow =>
      row.id === updated.id
        ? { ...row, status: updated.status ?? 'PENDING', approvedBy: updated.approvedBy ?? null, rejectionReason: updated.rejectionReason ?? null }
        : row;

    this.leaves = this.leaves.map(patch);
    this.managerLeaves = this.managerLeaves.map(patch);
    this.myLeaves = this.myLeaves.map(patch);
  }

  private loadLeaves(response: UserDashboardResponse): void {
    this.isLeavesLoading = true;

    this.leaveService.getLeaves().subscribe({
      next: (leaves) => {
        this.isLeavesLoading = false;
        const roleByUserId = new Map(
          response.users
            .filter((user) => user.role === 'MANAGER' || user.role === 'EMPLOYEE')
            .map((user) => [user.id, user.role] as const)
        );

        this.leaves = leaves
          .map((leave) => {
            const role = roleByUserId.get(leave.userId);
            if (!role) {
              return null;
            }
            const dates = (leave.leaveDates ?? []).map(d => ({ ...d, date: this.toDateString(d.date) }));
            const fromDate = dates.map(d => this.toDateString(d.date)).sort()[0] ?? '';
            const toDate = dates.map(d => this.toDateString(d.date)).sort().reverse()[0] ?? '';
            return {
              id: leave.id,
              userId: leave.userId,
              leaveTypeId: leave.leaveTypeId,
              fullName: leave.fullName?.trim() || 'Unknown user',
              emailId: leave.emailId?.trim() || 'No email',
              role,
              leaveType: leave.leaveType?.trim() || 'Unassigned',
              leaveDates: dates,
              fromDate,
              toDate,
              reason: leave.reason?.trim() || '',
              comments: leave.comments?.trim() || '',
              createdAt: leave.createdAt,
              durationDays: this.calculateDurationDays(dates),
              status: leave.status ?? 'PENDING',
              approvedBy: leave.approvedBy ?? null,
              rejectionReason: leave.rejectionReason ?? null,
              notifyUserIds: leave.notifyUserIds ?? [],
              editable: leave.editable ?? false
            } satisfies AdminLeaveTableRow;
          })
          .filter((leave): leave is AdminLeaveTableRow => leave !== null)
          .sort((left, right) => new Date(right.fromDate).getTime() - new Date(left.fromDate).getTime());
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        this.leaves = [];
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave records right now.'));
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

  private mapLeaveTypeErrors(error?: LeaveApiErrorResponse): Record<string, string> {
    const fieldErrors: Record<string, string> = {};

    for (const detail of error?.details ?? []) {
      const normalizedDetail = detail.trim();

      if (/leave name already exists/i.test(normalizedDetail)) {
        fieldErrors['leaveName'] = normalizedDetail;
        continue;
      }

      if (/leave unique name already exists/i.test(normalizedDetail)) {
        fieldErrors['leaveUniqueName'] = normalizedDetail;
        continue;
      }

      if (/max days/i.test(normalizedDetail) && !normalizedDetail.includes(':')) {
        fieldErrors['maxDays'] = normalizedDetail;
        continue;
      }

      const separatorIndex = detail.indexOf(':');
      if (separatorIndex === -1) {
        continue;
      }

      const rawField = detail.slice(0, separatorIndex).trim();
      const message = detail.slice(separatorIndex + 1).trim();
      const normalizedField = rawField.split('.').pop() ?? rawField;
      fieldErrors[normalizedField] = message;
    }

    return fieldErrors;
  }

  private buildLeaveTypeErrorMessage(
    error?: LeaveApiErrorResponse,
    fallback = 'Unable to save the leave type right now.'
  ): string {
    return error?.details?.[0] || fallback;
  }

  private toDateString(val: string | number[] | unknown): string {
    if (!val) return '';
    if (Array.isArray(val) && val.length >= 3) {
      const [y, m, d] = val as number[];
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return String(val);
  }

  private calculateDurationDays(leaveDates: { date: string | number[] | unknown; dayType: string }[]): number {
    return leaveDates.reduce((sum, d) => sum + (d.dayType && d.dayType.includes('HALF') ? 0.5 : 1.0), 0);
  }
}
