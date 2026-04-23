import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import {
  DashboardUserFormComponent,
  DashboardUserSubmitEvent
} from '../components/dashboard-user-form.component';
import { DashboardUserTableComponent } from '../components/dashboard-user-table.component';
import { AdminLeaveTableRow, DashboardLeaveTableComponent } from '../components/dashboard-leave-table.component';
import { UserExcelImportComponent } from '../components/user-excel-import.component';
import { LoginResponse, ManagedUser, UserDashboardResponse } from '../../services/auth.service';
import { LeaveType, LeaveTypeSavePayload, Holiday, CreateHolidayPayload } from '../../services/leave.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DashboardStatCardsComponent,
    DashboardUserFormComponent,
    DashboardUserTableComponent,
    DashboardLeaveTableComponent,
    UserExcelImportComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnChanges {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() isUserFormOpen = false;
  @Input() fieldErrors: Record<string, string> = {};
  @Input() leaveTypes: LeaveType[] = [];
  @Input() leaves: AdminLeaveTableRow[] = [];
  @Input() isLeaveTypesLoading = false;
  @Input() isLeavesLoading = false;
  @Input() isLeaveTypeSaving = false;
  @Input() leaveTypeFieldErrors: Record<string, string> = {};
  @Input() lastLeaveTypeCreatedAt = 0;
  @Input() filterRole = '';
  @Input() filterStatus = '';
  @Input() holidays: Holiday[] = [];
  @Input() isHolidaysLoading = false;
  @Input() deletingHolidayId: number | null = null;
  @Input() deletingLeaveTypeId: number | null = null;
  @Input() deletingUserId: number | null = null;
  @Input() isHolidaySaving = false;
  @Input() lastHolidaySavedAt = 0;
  @Input() processingLeaveId: number | null = null;

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() createRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() cancelEditRequested = new EventEmitter<void>();
  @Output() leaveTypeSaveRequested = new EventEmitter<LeaveTypeSavePayload>();
  @Output() leaveTypeDeleteRequested = new EventEmitter<LeaveType>();
  @Output() leaveApproveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() leaveRejectRequested = new EventEmitter<{ leave: AdminLeaveTableRow; reason: string }>();
  @Output() leavePartialStatusRequested = new EventEmitter<{ leave: AdminLeaveTableRow; decisions: import('../../services/leave.service').DateDecision[]; rejectionReason?: string }>();
  @Output() holidayCreateRequested = new EventEmitter<CreateHolidayPayload>();
  @Output() holidayUpdateRequested = new EventEmitter<{ id: number; payload: CreateHolidayPayload }>();
  @Output() holidayDeleteRequested = new EventEmitter<number>();
  @Output() importCompleted = new EventEmitter<void>();

  isImportPanelOpen = false;
  leaveTab: 'records' | 'types' | 'holidays' = 'records';
  isLeaveTypeModalOpen = false;
  editingLeaveType: LeaveType | null = null;
  leaveTypeSubmitted = false;
  leaveUniqueNameTouched = false;
  leaveTypeModel = this.createLeaveTypeModel();

  // Holiday form state
  isHolidayModalOpen = false;
  editingHoliday: Holiday | null = null;
  holidaySubmitted = false;
  holidayModel = this.createHolidayModel();

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Total visible users',
        value: this.dashboard?.totalUsers ?? 0,
        note: 'All accounts in the directory.',
        tone: 'teal',
        icon: 'fa-users',
        route: ['/dashboard', 'users'],
        actionLabel: 'Open users'
      },
      {
        label: 'Inactive accounts',
        value: this.dashboard?.inactiveUsers ?? 0,
        note: 'Require review.',
        tone: 'orange',
        icon: 'fa-user-slash',
        route: ['/dashboard', 'users'],
        queryParams: { status: 'INACTIVE' },
        actionLabel: 'Review users'
      },
      {
        label: 'Manager leave records',
        value: this.managerLeaveCount,
        note: 'Requests created by managers.',
        tone: 'teal',
        icon: 'fa-user-tie',
        route: ['/dashboard', 'leaves'],
        queryParams: { role: 'MANAGER' },
        actionLabel: 'Open leaves'
      },
      {
        label: 'Employee leave records',
        value: this.employeeLeaveCount,
        note: 'Requests created by employees.',
        tone: 'slate',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'leaves'],
        queryParams: { role: 'EMPLOYEE' },
        actionLabel: 'Open leaves'
      }
    ];
  }

  get assignableRoles(): string[] {
    return (this.dashboard?.assignableRoles ?? []).filter((role) => role !== 'ADMIN');
  }

  get managerLeaveCount(): number {
    return this.leaves.filter((leave) => leave.role === 'MANAGER').length;
  }

  get employeeLeaveCount(): number {
    return this.leaves.filter((leave) => leave.role === 'EMPLOYEE').length;
  }

  get isRecordsTabActive(): boolean {
    return this.leaveTab === 'records';
  }

  get isTypesTabActive(): boolean {
    return this.leaveTab === 'types';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lastLeaveTypeCreatedAt'] && !changes['lastLeaveTypeCreatedAt'].firstChange) {
      this.resetLeaveTypeEditor();
      this.isLeaveTypeModalOpen = false;
      this.leaveTab = 'types';
    }

    if (changes['lastHolidaySavedAt'] && !changes['lastHolidaySavedAt'].firstChange) {
      this.closeHolidayModal();
      this.leaveTab = 'holidays';
    }
  }

  selectLeaveTab(tab: 'records' | 'types' | 'holidays'): void {
    this.leaveTab = tab;
  }

  submitLeaveType(form: NgForm): void {
    this.leaveTypeSubmitted = true;
    this.normalizeLeaveTypeModel();

    if (form.invalid) {
      return;
    }

    this.leaveTypeSaveRequested.emit({
      id: this.editingLeaveType?.id,
      leaveName: this.leaveTypeModel.leaveName,
      leaveUniqueName: this.leaveTypeModel.leaveUniqueName,
      description: this.leaveTypeModel.description,
      maxDays: Number(this.leaveTypeModel.maxDays),
      genderRestriction: this.leaveTypeModel.genderRestriction || null
    });
  }

  resetLeaveTypeForm(): void {
    if (this.editingLeaveType) {
      this.populateLeaveTypeForm(this.editingLeaveType);
      return;
    }

    this.resetLeaveTypeEditor();
  }

  trackLeaveType(_: number, leaveType: LeaveType): number {
    return leaveType.id;
  }

  handleLeaveNameChange(value: string): void {
    this.leaveTypeModel = {
      ...this.leaveTypeModel,
      leaveName: value
    };

    if (!this.leaveUniqueNameTouched) {
      this.leaveTypeModel = {
        ...this.leaveTypeModel,
        leaveUniqueName: this.toUniqueCode(value)
      };
    }
  }

  handleLeaveUniqueNameChange(value: string): void {
    this.leaveUniqueNameTouched = true;
    this.leaveTypeModel = {
      ...this.leaveTypeModel,
      leaveUniqueName: value.toUpperCase().replace(/\s+/g, '_')
    };
  }

  openCreateLeaveTypeModal(): void {
    this.resetLeaveTypeEditor();
    this.isLeaveTypeModalOpen = true;
  }

  openEditLeaveTypeModal(leaveType: LeaveType): void {
    this.populateLeaveTypeForm(leaveType);
    this.isLeaveTypeModalOpen = true;
  }

  requestDeleteLeaveType(leaveType: LeaveType): void {
    this.leaveTypeDeleteRequested.emit(leaveType);
  }

  closeLeaveTypeModal(): void {
    if (this.isLeaveTypeSaving) {
      return;
    }

    this.isLeaveTypeModalOpen = false;
    this.resetLeaveTypeEditor();
  }

  get leaveTypeModalTitle(): string {
    return this.editingLeaveType ? 'Update leave type' : 'Create leave type';
  }

  get leaveTypeModalDescription(): string {
    return this.editingLeaveType
      ? 'Refine an existing leave category without changing the overall admin workflow.'
      : 'Define a clean leave category so managers and employees can select it consistently across the system.';
  }

  get leaveTypeSubmitLabel(): string {
    if (this.isLeaveTypeSaving) {
      return 'Saving...';
    }

    return 'Save';
  }

  get shouldShowLeaveTypeResetButton(): boolean {
    return this.editingLeaveType === null;
  }

  get hasLeaveTypes(): boolean {
    return this.leaveTypes.length > 0;
  }

  getLeaveTypeControlError(control: NgModel | null, field: 'leaveName' | 'leaveUniqueName' | 'maxDays'): string | null {
    if (this.leaveTypeFieldErrors[field]) {
      return this.leaveTypeFieldErrors[field];
    }

    if (!control || !this.shouldShowLeaveTypeError(control)) {
      return null;
    }

    if (control.errors?.['required']) {
      return (
        {
          leaveName: 'Leave name is required',
          leaveUniqueName: 'Unique code is required',
          maxDays: 'Maximum days is required'
        } satisfies Record<'leaveName' | 'leaveUniqueName' | 'maxDays', string>
      )[field];
    }

    if (control.errors?.['min'] || control.errors?.['max']) {
      return 'Enter a value between 1 and 365';
    }

    return null;
  }

  isLeaveTypeFieldInvalid(control: NgModel | null, field: 'leaveName' | 'leaveUniqueName' | 'maxDays'): boolean {
    return this.getLeaveTypeControlError(control, field) !== null;
  }

  get isHolidaysTabActive(): boolean {
    return this.leaveTab === 'holidays';
  }

  openCreateHolidayModal(): void {
    this.editingHoliday = null;
    this.holidaySubmitted = false;
    this.holidayModel = this.createHolidayModel();
    this.isHolidayModalOpen = true;
  }

  openEditHolidayModal(h: Holiday): void {
    this.editingHoliday = h;
    this.holidaySubmitted = false;
    this.holidayModel = { name: h.name, date: h.date, description: h.description ?? '' };
    this.isHolidayModalOpen = true;
  }

  closeHolidayModal(): void {
    if (this.isHolidaySaving) {
      return;
    }

    this.isHolidayModalOpen = false;
    this.editingHoliday = null;
    this.holidayModel = this.createHolidayModel();
  }

  submitHoliday(form: NgForm): void {
    this.holidaySubmitted = true;
    if (form.invalid) return;
    const payload: CreateHolidayPayload = {
      name: this.holidayModel.name.trim(),
      date: this.holidayModel.date,
      description: this.holidayModel.description.trim(),
      createdBy: ''
    };
    if (this.editingHoliday) {
      this.holidayUpdateRequested.emit({ id: this.editingHoliday.id, payload });
    } else {
      this.holidayCreateRequested.emit(payload);
    }
  }

  private createHolidayModel() {
    return { name: '', date: '', description: '' };
  }

  private normalizeLeaveTypeModel(): void {
    this.leaveTypeModel = {
      leaveName: this.leaveTypeModel.leaveName.trim(),
      leaveUniqueName: this.leaveTypeModel.leaveUniqueName.trim(),
      description: this.leaveTypeModel.description.trim(),
      maxDays: Number(this.leaveTypeModel.maxDays),
      genderRestriction: this.leaveTypeModel.genderRestriction
    };
  }

  private createLeaveTypeModel() {
    return {
      leaveName: '',
      leaveUniqueName: '',
      description: '',
      maxDays: 1,
      genderRestriction: '' as string
    };
  }

  private toUniqueCode(value: string): string {
    return value
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private shouldShowLeaveTypeError(control: NgModel | null): boolean {
    return control
      ? control.touched === true || control.dirty === true || this.leaveTypeSubmitted
      : this.leaveTypeSubmitted;
  }

  private resetLeaveTypeEditor(): void {
    this.leaveTypeSubmitted = false;
    this.leaveUniqueNameTouched = false;
    this.leaveTypeFieldErrors = {};
    this.editingLeaveType = null;
    this.leaveTypeModel = this.createLeaveTypeModel();
  }

  private populateLeaveTypeForm(leaveType: LeaveType): void {
    this.editingLeaveType = leaveType;
    this.leaveTypeSubmitted = false;
    this.leaveUniqueNameTouched = true;
    this.leaveTypeFieldErrors = {};
    this.leaveTypeModel = {
      leaveName: leaveType.leaveName ?? '',
      leaveUniqueName: leaveType.leaveUniqueName ?? '',
      description: leaveType.description ?? '',
      maxDays: leaveType.maxDays ?? 1,
      genderRestriction: leaveType.genderRestriction ?? ''
    };
  }
}
