import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { AuthApiService } from '../services/auth-api.service';
import { LeaveApiService } from '../services/leave-api.service';
import { DashboardCacheService } from '../services/dashboard-cache.service';
import {
  ApiErrorResponse,
  LoginResponse,
  ManagedUser,
  UserManagementPayload,
  UserDashboardResponse
} from '../services/auth.service';
import { CreateLeavePayload, LeaveApiErrorResponse, LeaveType, LeaveTypeSavePayload, UpdateLeaveStatusPayload, PartialLeaveStatusPayload, NotifyUser, Holiday, CreateHolidayPayload } from '../services/leave.service';
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
import { TranslatePipe } from '../i18n/translate.pipe';
import { TranslateService, Language } from '../i18n/translate.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminDashboardComponent,
    ManagerDashboardComponent,
    EmployeeDashboardComponent,
    DashboardLeaveFormComponent,
    TranslatePipe
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
  bookedDates: string[] = [];
  isHolidaysLoading = false;
  deletingUserId: number | null = null;
  processingLeaveId: number | null = null;
  deletingLeaveId: number | null = null;
  deletingLeaveTypeId: number | null = null;
  deletingHolidayId: number | null = null;
  isHolidaySaving = false;
  lastHolidaySavedAt = 0;

  constructor(
    authService: AuthApiService,
    leaveService: LeaveApiService,
    public translateService: TranslateService,
    private readonly dashboardCache: DashboardCacheService,
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

    // Restore from cache instantly — no spinner, no API call
    const cached = this.dashboardCache.get(this.user.username);
    if (cached) {
      this.restoreFromCache(cached);
      // If stale, silently refresh in background
      if (this.dashboardCache.isStale(this.user.username)) {
        this.loadDashboard(true);
      }
    } else {
      this.loadDashboard();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user'] && !changes['user'].firstChange) {
      const prev: LoginResponse = changes['user'].previousValue;
      const curr: LoginResponse = changes['user'].currentValue;
      const identityChanged =
        prev?.username !== curr?.username ||
        prev?.role !== curr?.role ||
        prev?.active !== curr?.active;
      if (identityChanged) {
        this.dashboardCache.invalidate();
        this.loadDashboard();
      }
    }

    if (changes['user'] && !this.isProfileModalOpen) {
      this.syncProfileModel();
    }
  }

  get normalizedRole(): 'ADMIN' | 'MANAGER' | 'EMPLOYEE' {
    return normalizeDashboardRole(this.user.role);
  }

  get pageHeading(): string {
    const keys: Record<DashboardPageId, string> = {
      overview: 'pageHeaders.overview',
      users: 'pageHeaders.users',
      roles: 'pageHeaders.roles',
      leaves: 'pageHeaders.leaves',
      reports: 'pageHeaders.reports',
      settings: 'pageHeaders.settings',
      team: 'pageHeaders.team',
      approvals: 'pageHeaders.approvals',
      calendar: 'pageHeaders.calendar',
      profile: 'pageHeaders.profile',
      requests: 'pageHeaders.requests',
      history: 'pageHeaders.history'
    };
    return this.translateService.getTranslation(keys[this.pageId]);
  }

  get pageDescription(): string {
    const keys: Record<DashboardPageId, string> = {
      overview: 'pageHeaders.overviewDesc',
      users: 'pageHeaders.usersDesc',
      roles: 'pageHeaders.rolesDesc',
      leaves: 'pageHeaders.leavesDesc',
      reports: 'pageHeaders.reportsDesc',
      settings: 'pageHeaders.settingsDesc',
      team: 'pageHeaders.teamDesc',
      approvals: 'pageHeaders.approvalsDesc',
      calendar: 'pageHeaders.calendarDesc',
      profile: 'pageHeaders.profileDesc',
      requests: 'pageHeaders.requestsDesc',
      history: 'pageHeaders.historyDesc'
    };
    return this.translateService.getTranslation(keys[this.pageId]);
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
    this.dashboardCache.invalidate();
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

    if (form.invalid) {
      return;
    }

    this.isProfileSaving = true;
    this.profileFieldErrors = {};

    this.authService.updateProfile(actor.id, this.profileModel.fullName, this.profileModel.gender).subscribe({
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
        this.dashboardCache.invalidate();
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
        this.dashboardCache.invalidate();
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

    this.deletingUserId = user.id;
    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.deletingUserId = null;
        if (this.editingUser?.id === user.id) {
          this.editingUser = null;
        }
        this.toastService.success('User deleted successfully');
        this.dashboardCache.invalidate();
        this.loadDashboard();
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.deletingUserId = null;
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
    this.leaveService.getBookedDates(this.user.username).subscribe({
      next: (dates) => { this.bookedDates = dates; },
      error: () => { this.bookedDates = []; }
    });
  }

  cancelLeaveForm(): void {
    this.isLeaveFormOpen = false;
    this.isLeaveSaving = false;
    this.leaveFieldErrors = {};
    this.editingLeave = null;
  }

  handleApproveLeave(leave: AdminLeaveTableRow): void {
    // Manager approves → MANAGER_APPROVED (goes to admin for final approval)
    // Admin approves → APPROVED (final)
    const status = this.user.role === 'MANAGER' ? 'MANAGER_APPROVED' : 'APPROVED';
    this.updateLeaveStatus(leave.id, status);
  }

  handleRejectLeave(event: { leave: AdminLeaveTableRow; reason: string }): void {
    this.updateLeaveStatus(event.leave.id, 'REJECTED', event.reason);
  }

  handlePartialLeaveStatus(event: { leave: AdminLeaveTableRow; decisions: import('../services/leave.service').DateDecision[]; rejectionReason?: string }): void {
    this.processingLeaveId = event.leave.id;
    const payload: PartialLeaveStatusPayload = {
      actorUsername: this.user.username,
      dateDecisions: event.decisions,
      rejectionReason: event.rejectionReason
    };
    this.leaveService.applyPartialStatus(event.leave.id, payload).subscribe({
      next: (updated) => {
        this.processingLeaveId = null;
        this.updateLeaveInList(updated);
        const approvedCount = event.decisions.filter(d => d.status === 'APPROVED').length;
        const rejectedCount = event.decisions.filter(d => d.status === 'REJECTED').length;
        if (rejectedCount === 0) {
          this.toastService.success('All dates approved');
        } else if (approvedCount === 0) {
          this.toastService.success('Leave request rejected');
        } else {
          this.toastService.success(`${approvedCount} date(s) approved, ${rejectedCount} rejected — 2 emails sent`);
        }
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.processingLeaveId = null;
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to apply partial status.'));
      }
    });
  }

  private updateLeaveStatus(leaveId: number, status: 'APPROVED' | 'REJECTED' | 'MANAGER_APPROVED', rejectionReason?: string): void {
    const payload: UpdateLeaveStatusPayload = {
      actorUsername: this.user.username,
      status,
      ...(rejectionReason ? { rejectionReason } : {})
    };

    this.processingLeaveId = leaveId;
    this.leaveService.updateLeaveStatus(leaveId, payload).subscribe({
      next: (updated) => {
        this.processingLeaveId = null;
        this.updateLeaveInList(updated);
        if (status === 'MANAGER_APPROVED') {
          this.toastService.success('Leave approved — sent to admin for final approval');
        } else {
          this.toastService.success(status === 'APPROVED' ? 'Leave request approved' : 'Leave request rejected');
        }
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.processingLeaveId = null;
        const action = status === 'APPROVED' || status === 'MANAGER_APPROVED' ? 'approve' : 'reject';
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, `Unable to ${action} leave request.`));
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
        this.dashboardCache.invalidate();
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

    this.deletingLeaveId = leave.id;
    this.leaveService.deleteLeave(leave.id).subscribe({
      next: () => {
        this.deletingLeaveId = null;
        if (this.editingLeave?.id === leave.id) {
          this.cancelLeaveForm();
        }
        this.toastService.success('Leave request deleted successfully');
        this.dashboardCache.invalidate();
        this.loadDashboard();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.deletingLeaveId = null;
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
        this.dashboardCache.invalidate();
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

    this.deletingLeaveTypeId = leaveType.id;
    this.leaveService.deleteLeaveType(leaveType.id).subscribe({
      next: () => {
        this.deletingLeaveTypeId = null;
        this.leaveTypes = this.leaveTypes.filter((existingLeaveType) => existingLeaveType.id !== leaveType.id);
        this.toastService.success('Leave type deleted successfully');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.deletingLeaveTypeId = null;
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

  protected loadDashboard(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }
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
          this.loadLeaves(response, silent);
        }
        if (this.normalizedRole === 'MANAGER') {
          this.loadManagerLeaves(response, silent);
        }
        if (this.normalizedRole === 'EMPLOYEE') {
          this.loadMyLeaves(response, silent);
          this.leaveService.getNotifyUsers(this.user.username).subscribe({
            next: (users) => { this.notifyUsers = users; },
            error: () => { this.notifyUsers = []; }
          });
        }
        this.loadLeaveTypes(silent);
        this.loadHolidays(silent);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        if (!silent) {
          this.dashboard = null;
          this.errorMessage = err.error?.message || 'Unable to load dashboard data.';
          this.toastService.error(this.errorMessage);
        }
      }
    });
  }

  private restoreFromCache(cached: import('../services/dashboard-cache.service').DashboardCacheEntry): void {
    this.dashboard = cached.dashboard;
    this.leaveTypes = cached.leaveTypes;
    this.holidays = cached.holidays;
    this.leaves = cached.leaves;
    this.managerLeaves = cached.managerLeaves;
    this.myLeaves = cached.myLeaves;
    if (!this.isProfileModalOpen) {
      this.syncProfileModel();
    }
    if (this.normalizedRole === 'EMPLOYEE') {
      this.leaveService.getNotifyUsers(this.user.username).subscribe({
        next: (users) => { this.notifyUsers = users; },
        error: () => { this.notifyUsers = []; }
      });
    }
  }

  private writeCacheWhenReady(): void {
    // Write to cache once all async loads have settled
    // We use a short debounce so all parallel loads complete first
    setTimeout(() => {
      if (this.dashboard) {
        this.dashboardCache.set({
          username: this.user.username,
          dashboard: this.dashboard,
          leaveTypes: this.leaveTypes,
          holidays: this.holidays,
          leaves: this.leaves,
          managerLeaves: this.managerLeaves,
          myLeaves: this.myLeaves,
          cachedAt: Date.now()
        });
      }
    }, 800);
  }

  private loadLeaveTypes(silent = false): void {
    if (!silent) this.isLeaveTypesLoading = true;

    this.leaveService.getLeaveTypes().subscribe({
      next: (leaveTypes) => {
        this.isLeaveTypesLoading = false;
        this.leaveTypes = leaveTypes;
        this.writeCacheWhenReady();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeaveTypesLoading = false;
        this.leaveTypes = [];
        if (!silent) this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave types right now.'));
      }
    });
  }

  private loadHolidays(silent = false): void {
    if (!silent) this.isHolidaysLoading = true;
    this.leaveService.getHolidays().subscribe({
      next: (h) => { this.holidays = h; this.isHolidaysLoading = false; this.writeCacheWhenReady(); },
      error: () => { this.holidays = []; this.isHolidaysLoading = false; }
    });
  }

  handleCreateHoliday(payload: CreateHolidayPayload): void {
    this.isHolidaySaving = true;
    this.leaveService.createHoliday({ ...payload, createdBy: this.user.username }).subscribe({
      next: (h) => {
        this.isHolidaySaving = false;
        this.lastHolidaySavedAt = Date.now();
        this.holidays = [...this.holidays, h].sort((a, b) => a.date.localeCompare(b.date));
        this.toastService.success('Holiday created');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isHolidaySaving = false;
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to create holiday.'));
      }
    });
  }

  handleUpdateHoliday(event: { id: number; payload: CreateHolidayPayload }): void {
    this.isHolidaySaving = true;
    this.leaveService.updateHoliday(event.id, event.payload).subscribe({
      next: (h) => {
        this.isHolidaySaving = false;
        this.lastHolidaySavedAt = Date.now();
        this.holidays = this.holidays.map((x) => x.id === h.id ? h : x);
        this.toastService.success('Holiday updated');
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isHolidaySaving = false;
        this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to update holiday.'));
      }
    });
  }

  handleDeleteHoliday(id: number): void {
    if (!confirm('Delete this holiday?')) return;
    this.deletingHolidayId = id;
    this.leaveService.deleteHoliday(id).subscribe({
      next: () => {
        this.deletingHolidayId = null;
        this.holidays = this.holidays.filter((h) => h.id !== id);
        this.toastService.success('Holiday deleted');
      },
      error: () => {
        this.deletingHolidayId = null;
        this.toastService.error('Unable to delete holiday.');
      }
    });
  }

  private mapLeaveToRow(
    leave: import('../services/leave.service').LeaveRecord,
    role: string,
    fallbackName?: string,
    fallbackEmail?: string,
    userDirectory: Record<string, string> = {}
  ): AdminLeaveTableRow {
    const dates = (leave.leaveDates ?? []).map(d => ({ ...d, date: this.toDateString(d.date) }));
    const sortedDates = dates.map(d => this.toDateString(d.date)).sort();
    const normalizedApproval = this.normalizeApprovalActors(leave);
    return {
      id: leave.id,
      userId: leave.userId,
      leaveTypeId: leave.leaveTypeId,
      fullName: leave.fullName?.trim() || fallbackName || 'Unknown user',
      emailId: leave.emailId?.trim() || fallbackEmail || 'No email',
      role,
      leaveType: leave.leaveType?.trim() || 'Unassigned',
      leaveDates: dates,
      fromDate: sortedDates[0] ?? '',
      toDate: sortedDates[sortedDates.length - 1] ?? '',
      reason: leave.reason?.trim() || '',
      comments: leave.comments?.trim() || '',
      trail: leave.trail ?? null,
      createdAt: leave.createdAt,
      durationDays: this.calculateDurationDays(dates),
      status: normalizedApproval.status,
      approvedBy: normalizedApproval.approvedBy,
      managerApprovedBy: normalizedApproval.managerApprovedBy,
      managerRejectedBy: normalizedApproval.managerRejectedBy,
      managerApprovedAt: normalizedApproval.managerApprovedAt,
      managerRejectedAt: normalizedApproval.managerRejectedAt,
      adminApprovedBy: normalizedApproval.adminApprovedBy,
      adminRejectedBy: normalizedApproval.adminRejectedBy,
      adminApprovedAt: normalizedApproval.adminApprovedAt,
      adminRejectedAt: normalizedApproval.adminRejectedAt,
      rejectionReason: leave.rejectionReason ?? null,
      userDirectory,
      notifyUserIds: leave.notifyUserIds ?? [],
      editable: leave.editable ?? false
    };
  }

  private loadManagerLeaves(response: UserDashboardResponse, silent = false): void {
    if (!silent) this.isLeavesLoading = true;
    const userDirectory = this.buildUserDirectory(response);

    this.leaveService.getLeavesByManagerUsername(this.user.username).subscribe({
      next: (leaves) => {
        this.isLeavesLoading = false;
        this.managerLeaves = leaves
          .map((leave) => {
            const role = response.users.find((u) => u.id === leave.userId)?.role ?? 'EMPLOYEE';
            return this.mapLeaveToRow(leave, role, undefined, undefined, userDirectory);
          })
          .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime());
        this.writeCacheWhenReady();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        if (!silent) this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave records.'));
      }
    });
  }

  private loadMyLeaves(response: UserDashboardResponse, silent = false): void {
    if (!silent) this.isLeavesLoading = true;
    const userDirectory = this.buildUserDirectory(response);

    this.leaveService.getLeavesByUsername(this.user.username).subscribe({
      next: (leaves) => {
        this.isLeavesLoading = false;
        this.myLeaves = leaves
          .map((leave) => this.mapLeaveToRow(
            leave,
            'EMPLOYEE',
            response.actor?.fullName || 'Me',
            response.actor?.email || '',
            userDirectory
          ))
          .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime());
        this.writeCacheWhenReady();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        this.myLeaves = [];
        if (!silent) this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load your leave records.'));
      }
    });
  }

  private updateLeaveInList(updated: import('../services/leave.service').LeaveRecord): void {
    const normalizedApproval = this.normalizeApprovalActors(updated);
    const patch = (row: AdminLeaveTableRow): AdminLeaveTableRow => {
      if (row.id !== updated.id) {
        return row;
      }

      const hasUpdatedDates = (updated.leaveDates ?? []).length > 0;
      const remapped = this.mapLeaveToRow(
        {
          ...updated,
          leaveDates: hasUpdatedDates ? updated.leaveDates : row.leaveDates
        },
        row.role,
        row.fullName,
        row.emailId,
        row.userDirectory
      );

      return {
        ...remapped,
        status: normalizedApproval.status,
        approvedBy: normalizedApproval.approvedBy,
        managerApprovedBy: normalizedApproval.managerApprovedBy,
        managerRejectedBy: normalizedApproval.managerRejectedBy,
        managerApprovedAt: normalizedApproval.managerApprovedAt,
        managerRejectedAt: normalizedApproval.managerRejectedAt,
        adminApprovedBy: normalizedApproval.adminApprovedBy,
        adminRejectedBy: normalizedApproval.adminRejectedBy,
        adminApprovedAt: normalizedApproval.adminApprovedAt,
        adminRejectedAt: normalizedApproval.adminRejectedAt,
        rejectionReason: updated.rejectionReason ?? null,
        userDirectory: row.userDirectory
      };
    };

    this.leaves = this.leaves.map(patch);
    this.managerLeaves = this.managerLeaves.map(patch);
    this.myLeaves = this.myLeaves.map(patch);
  }

  private normalizeApprovalActors(leave: import('../services/leave.service').LeaveRecord): Pick<
    AdminLeaveTableRow,
    | 'status'
    | 'approvedBy'
    | 'managerApprovedBy'
    | 'managerRejectedBy'
    | 'managerApprovedAt'
    | 'managerRejectedAt'
    | 'adminApprovedBy'
    | 'adminRejectedBy'
    | 'adminApprovedAt'
    | 'adminRejectedAt'
  > {
    const status = leave.status ?? 'PENDING';
    const approvedBy = leave.approvedBy ?? null;
    let managerApprovedBy = leave.managerApprovedBy ?? null;
    const managerRejectedBy = leave.managerRejectedBy ?? null;
    const managerApprovedAt = leave.managerApprovedAt ?? null;
    const managerRejectedAt = leave.managerRejectedAt ?? null;
    let adminApprovedBy = leave.adminApprovedBy ?? null;
    let adminRejectedBy = leave.adminRejectedBy ?? null;
    let adminApprovedAt = leave.adminApprovedAt ?? null;
    let adminRejectedAt = leave.adminRejectedAt ?? null;

    if (status === 'MANAGER_APPROVED') {
      if (!managerApprovedBy && approvedBy) {
        managerApprovedBy = approvedBy;
      }
      adminApprovedBy = null;
      adminRejectedBy = null;
      adminApprovedAt = null;
      adminRejectedAt = null;
    } else if (status === 'APPROVED') {
      if (!adminApprovedBy && approvedBy) {
        adminApprovedBy = approvedBy;
      }
    } else if (status === 'REJECTED' && managerRejectedBy) {
      adminApprovedBy = null;
      adminRejectedBy = null;
      adminApprovedAt = null;
      adminRejectedAt = null;
    }

    return {
      status,
      approvedBy,
      managerApprovedBy,
      managerRejectedBy,
      managerApprovedAt,
      managerRejectedAt,
      adminApprovedBy,
      adminRejectedBy,
      adminApprovedAt,
      adminRejectedAt
    };
  }

  private loadLeaves(response: UserDashboardResponse, silent = false): void {
    if (!silent) this.isLeavesLoading = true;
    const userDirectory = this.buildUserDirectory(response);

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
            if (!role) return null;
            return this.mapLeaveToRow(leave, role, undefined, undefined, userDirectory);
          })
          .filter((leave): leave is AdminLeaveTableRow => leave !== null)
          .sort((left, right) => new Date(right.fromDate).getTime() - new Date(left.fromDate).getTime());
        this.writeCacheWhenReady();
      },
      error: (err: { error?: LeaveApiErrorResponse }) => {
        this.isLeavesLoading = false;
        this.leaves = [];
        if (!silent) this.toastService.error(this.buildLeaveTypeErrorMessage(err.error, 'Unable to load leave records right now.'));
      }
    });
  }

  private syncEditingUser(response: UserDashboardResponse): void {
    if (!this.editingUser) {
      return;
    }

    this.editingUser = response.users.find((user) => user.id === this.editingUser?.id) ?? null;
  }

  private buildUserDirectory(response: UserDashboardResponse): Record<string, string> {
    const entries = [response.actor, ...(response.users ?? [])]
      .filter((user): user is ManagedUser => !!user)
      .map((user) => [user.username?.trim().toLowerCase(), user.fullName?.trim()] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[0] && !!entry[1]);

    return Object.fromEntries(entries);
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

  isLangDropdownOpen = false;
  availableLangs = [
    { code: 'en', label: 'English (US)' },
    { code: 'es', label: 'Español (ES)' },
    { code: 'fr', label: 'Français (FR)' },
    { code: 'de', label: 'Deutsch (DE)' },
    { code: 'zh', label: '中文 (ZH)' },
    { code: 'ru', label: 'Русский (RU)' },
    { code: 'ja', label: '日本語 (JA)' },
    { code: 'ar', label: 'العربية (AR)' },
    { code: 'hi', label: 'हिन्दी (HI)' },
    { code: 'pt', label: 'Português (PT)' },
    { code: 'ko', label: '한국어 (KO)' },
    { code: 'it', label: 'Italiano (IT)' },
    { code: 'tr', label: 'Türkçe (TR)' },
    { code: 'nl', label: 'Nederlands (NL)' },
    { code: 'pl', label: 'Polski (PL)' },
    { code: 'th', label: 'ไทย (TH)' },
    { code: 'vi', label: 'Tiếng Việt (VI)' },
    { code: 'id', label: 'Bahasa Indonesia (ID)' },
    { code: 'sv', label: 'Svenska (SV)' },
    { code: 'bn', label: 'বাংলা (BN)' }
  ];

  getSelectedLangLabel(): string {
    const code = this.translateService.currentLang() || 'en';
    const lang = this.availableLangs.find(l => l.code === code);
    return lang ? lang.label : 'Select language';
  }

  toggleLangDropdown(event: Event): void {
    event.stopPropagation();
    this.isLangDropdownOpen = !this.isLangDropdownOpen;
  }

  selectLang(code: string): void {
    this.translateService.setLanguage(code as Language);
    this.isLangDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickLang(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown-container') && !target.closest('.profile-trigger')) {
      this.isLangDropdownOpen = false;
    }
  }
}
