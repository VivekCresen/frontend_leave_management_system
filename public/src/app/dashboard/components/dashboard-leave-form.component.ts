import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminLeaveTableRow } from '../components/dashboard-leave-table.component';
import { Holiday, LeaveType, NotifyUser } from '../../services/leave.service';
import { ToastService } from '../../services/toast.service';

export interface LeaveFormSubmitEvent {
  leaveTypeId: number;
  leaveType: string;
  reason: string;
  comments: string;
  notifyUserIds: number[];
  daySelections: LeaveDaySelection[];
}

export type LeaveDaySession = 'FULL' | 'MORNING' | 'AFTERNOON';

export interface LeaveDaySelection {
  date: string;
  session: LeaveDaySession;
}

type SelectionCalendarDay = {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  selectedSession: LeaveDaySession | null;
};

type LeaveFormModel = {
  leaveTypeId: number | null;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  durationType: 'FULL' | 'HALF';
  halfDaySession: 'MORNING' | 'AFTERNOON';
  notifyUserIds: number[];
};

@Component({
  selector: 'app-dashboard-leave-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-leave-form.component.html',
  styleUrls: ['./dashboard-leave-form.component.css']
})
export class DashboardLeaveFormComponent implements OnChanges {
  readonly maxRequestDurationDays = 21;

  @Input({ required: true }) leaveTypes: LeaveType[] = [];
  @Input() userGender: string | null = null;
  @Input() myLeaves: AdminLeaveTableRow[] = [];
  @Input() holidays: Holiday[] = [];
  @Input() notifyUsers: NotifyUser[] = [];
  @Input() notifyUsersLoading = false;
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};
  @Input() editingLeave: AdminLeaveTableRow | null = null;

  @Output() saveRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelRequested = new EventEmitter<void>();

  @ViewChild('leaveForm') private leaveForm?: NgForm;

  submitted = false;
  model: LeaveFormModel = this.createDefaultModel();
  isSelectionCalendarOpen = false;
  selectionCalendarMonth = new Date().getMonth();
  selectionCalendarYear = new Date().getFullYear();
  selectedDaySessions: Record<string, LeaveDaySession> = {};
  readonly calendarWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Random time slots for half-day display
  readonly morningSlots = ['9:00 AM – 1:00 PM', '9:30 AM – 1:30 PM', '10:00 AM – 2:00 PM'];
  readonly afternoonSlots = ['1:00 PM – 5:00 PM', '1:30 PM – 5:30 PM', '2:00 PM – 6:00 PM'];
  randomMorningTime = this.morningSlots[Math.floor(Math.random() * this.morningSlots.length)];
  randomAfternoonTime = this.afternoonSlots[Math.floor(Math.random() * this.afternoonSlots.length)];

  get isHalfDay(): boolean {
    return this.model.durationType === 'HALF';
  }

  get usesDaySpecificCalendar(): boolean {
    return !this.isEditMode;
  }

  constructor(private readonly toast: ToastService) {}

  get availableLeaveTypes(): LeaveType[] {
    if (!this.userGender) return this.leaveTypes;
    const gender = this.userGender.toUpperCase();
    return this.leaveTypes.filter(
      (lt) => !lt.genderRestriction || lt.genderRestriction === gender
    );
  }

  get genderRestrictedCount(): number {
    if (!this.userGender) return 0;
    const gender = this.userGender.toUpperCase();
    return this.leaveTypes.filter(
      (lt) => lt.genderRestriction && lt.genderRestriction !== gender
    ).length;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingLeave']) {
      this.populateForm(this.editingLeave);
    }

    if (changes['userGender'] && !changes['userGender'].firstChange && this.genderRestrictedCount > 0) {
      const count = this.genderRestrictedCount;
      this.toast.info(`${count} leave type${count === 1 ? ' is' : 's are'} not available for your gender.`);
    }
  }

  get isEditMode(): boolean {
    return !!this.editingLeave;
  }

  get headingTitle(): string {
    return this.isEditMode ? 'Edit leave request' : 'Apply for leave';
  }

  get headingDescription(): string {
    return this.isEditMode
      ? 'Update the details of your pending leave request before approval.'
      : 'Fill in the details below and submit your leave request for approval.';
  }

  get submitLabel(): string {
    if (this.isSaving) {
      return this.isEditMode ? 'Saving...' : 'Submitting...';
    }

    return this.isEditMode ? 'Save changes' : 'Submit request';
  }

  onLeaveTypeChange(): void {
    const lt = this.selectedLeaveType;
    if (!lt) return;

    if (lt.description) {
      this.toast.info(lt.description);
    }

    if (lt.genderRestriction) {
      const label = lt.genderRestriction === 'MALE' ? 'Male' : 'Female';
      this.toast.info(`${lt.leaveName} is restricted to ${label} employees only.`);
    }
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get minToDate(): string {
    return this.model.fromDate || this.today;
  }

  get durationDays(): number {
    if (this.usesDaySpecificCalendar) {
      return this.selectedDaySelections.reduce((sum, selection) => sum + (selection.session === 'FULL' ? 1 : 0.5), 0);
    }

    if (!this.model.fromDate || !this.model.toDate) return 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    if (to < from) return 0;

    let workingDays = 0;
    const cur = new Date(from);
    while (cur <= to) {
      if (this.isWorkingDay(cur)) workingDays++;
      cur.setDate(cur.getDate() + 1);
    }

    return this.isHalfDay ? workingDays * 0.5 : workingDays;
  }

  get totalCalendarDays(): number {
    if (this.usesDaySpecificCalendar) {
      return this.selectedDaySelections.length;
    }

    if (!this.model.fromDate || !this.model.toDate) return 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  }

  get weekendDaysCount(): number {
    if (this.usesDaySpecificCalendar) {
      return 0;
    }

    if (!this.model.fromDate || !this.model.toDate) return 0;

    let count = 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    const cur = new Date(from);

    while (cur <= to) {
      const day = cur.getDay();
      if (day === 0 || day === 6) count++;
      cur.setDate(cur.getDate() + 1);
    }

    return count;
  }

  get publicHolidayCount(): number {
    if (this.usesDaySpecificCalendar) {
      return 0;
    }

    if (!this.model.fromDate || !this.model.toDate) return 0;

    let count = 0;
    const from = new Date(this.model.fromDate);
    const to = new Date(this.model.toDate);
    const cur = new Date(from);

    while (cur <= to) {
      if (this.isHolidayDate(cur) && cur.getDay() !== 0 && cur.getDay() !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }

    return count;
  }

  get selectedLeaveType(): LeaveType | null {
    return this.leaveTypes.find((lt) => lt.id === this.model.leaveTypeId) ?? null;
  }

  get dateRangeError(): string | null {
    if (this.usesDaySpecificCalendar) {
      return null;
    }

    if (!this.submitted) return null;
    if (!this.model.fromDate) return 'Start date is required';
    if (!this.model.toDate) return 'End date is required';
    if (new Date(this.model.toDate) < new Date(this.model.fromDate)) {
      return 'End date must be on or after start date';
    }
    return null;
  }

  getFieldError(field: string): string | null {
    return this.fieldErrors[field] ?? null;
  }

  get exceedsMaxDays(): boolean {
    const lt = this.selectedLeaveType;
    return !!lt && this.durationDays > lt.maxDays;
  }

  get exceedsRequestDurationLimit(): boolean {
    // Only apply the global 21-day cap when no leave type is selected
    // (leave type's own maxDays takes priority when a type is chosen)
    if (this.selectedLeaveType) return false;
    return this.durationDays > this.maxRequestDurationDays;
  }

  get isSubmitDisabled(): boolean {
    return this.isSaving || this.exceedsRequestDurationLimit || this.exceedsMaxDays;
  }

  get hasNoWorkingDaysSelected(): boolean {
    if (this.usesDaySpecificCalendar) {
      return this.selectedDaySelections.length === 0;
    }

    if (!this.model.fromDate) return false;
    return this.durationDays === 0;
  }

  get selectedDaySelections(): LeaveDaySelection[] {
    return Object.entries(this.selectedDaySessions)
      .map(([date, session]) => ({ date, session }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  get selectionCalendarMonthLabel(): string {
    return new Date(this.selectionCalendarYear, this.selectionCalendarMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get selectionCalendarWeeks(): SelectionCalendarDay[][] {
    const firstDay = new Date(this.selectionCalendarYear, this.selectionCalendarMonth, 1);
    const lastDay = new Date(this.selectionCalendarYear, this.selectionCalendarMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = this.toDateKey(today);

    const weeks: SelectionCalendarDay[][] = [];
    let week: SelectionCalendarDay[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dateKey = this.toDateKey(cursor);
      const holiday = this.holidays.find((item) => item.date === dateKey) ?? null;
      week.push({
        date: new Date(cursor),
        dateKey,
        dayNumber: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === this.selectionCalendarMonth,
        isToday: dateKey === todayKey,
        isPast: new Date(cursor).getTime() < today.getTime(),
        isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
        isHoliday: !!holiday,
        holidayName: holiday?.name ?? null,
        selectedSession: this.selectedDaySessions[dateKey] ?? null
      });

      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return weeks;
  }

  toggleNotifyUser(userId: number): void {
    const idx = this.model.notifyUserIds.indexOf(userId);
    if (idx === -1) {
      this.model.notifyUserIds = [...this.model.notifyUserIds, userId];
    } else {
      this.model.notifyUserIds = this.model.notifyUserIds.filter((id) => id !== userId);
    }
  }

  isNotifyUserSelected(userId: number): boolean {
    return this.model.notifyUserIds.includes(userId);
  }

  submit(form: NgForm): void {
    this.submitted = true;

    if (form.invalid || this.dateRangeError) {
      return;
    }

    const leaveType = this.selectedLeaveType;
    if (!leaveType || !this.model.leaveTypeId) return;

    if (this.exceedsMaxDays) {
      this.toast.warn(
        `Selected duration (${this.durationDays} days) exceeds the maximum allowed ${leaveType.maxDays} days for ${leaveType.leaveName}.`
      );
      return;
    }

    if (this.exceedsRequestDurationLimit) {
      this.toast.warn(
        `Selected duration (${this.durationDays} days) exceeds the maximum allowed ${this.maxRequestDurationDays} days per request.`
      );
      return;
    }

    if (this.hasNoWorkingDaysSelected) {
      this.toast.warn(
        `Excluding ${this.weekendDaysCount} weekend day${this.weekendDaysCount === 1 ? '' : 's'} and ${this.publicHolidayCount} public holiday${this.publicHolidayCount === 1 ? '' : 's'}. Please choose at least one working day.`
      );
      return;
    }

    if (this.usesDaySpecificCalendar) {
      const selections = this.selectedDaySelections;
      this.saveRequested.emit({
        leaveTypeId: this.model.leaveTypeId,
        leaveType: leaveType.leaveName,
        reason: this.model.reason.trim(),
        comments: this.model.comments.trim(),
        notifyUserIds: this.model.notifyUserIds,
        daySelections: selections
      });
      return;
    }

    const isHalf = this.isHalfDay;
    this.saveRequested.emit({
      leaveTypeId: this.model.leaveTypeId,
      leaveType: leaveType.leaveName,
      reason: this.model.reason.trim(),
      comments: this.model.comments.trim(),
      notifyUserIds: this.model.notifyUserIds,
      daySelections: []
    });
  }

  cancel(): void {
    this.cancelRequested.emit();
    this.reset();
  }

  reset(): void {
    this.submitted = false;
    this.model = this.createModelFromLeave(this.editingLeave);
    this.selectedDaySessions = this.createDaySelectionsFromLeave(this.editingLeave);
    this.syncSelectionCalendarToSelectedDays();
    this.isSelectionCalendarOpen = false;
    this.randomMorningTime = this.morningSlots[Math.floor(Math.random() * this.morningSlots.length)];
    this.randomAfternoonTime = this.afternoonSlots[Math.floor(Math.random() * this.afternoonSlots.length)];
    this.leaveForm?.resetForm(this.model);
  }

  onFromDateChange(): void {
    if (!this.model.toDate || this.model.toDate < this.model.fromDate) {
      this.model.toDate = this.model.fromDate;
    }
  }

  openSelectionCalendar(): void {
    this.isSelectionCalendarOpen = true;
    this.syncSelectionCalendarToSelectedDays();
  }

  closeSelectionCalendar(): void {
    this.isSelectionCalendarOpen = false;
  }

  previousSelectionMonth(): void {
    if (this.selectionCalendarMonth === 0) {
      this.selectionCalendarMonth = 11;
      this.selectionCalendarYear -= 1;
      return;
    }

    this.selectionCalendarMonth -= 1;
  }

  nextSelectionMonth(): void {
    if (this.selectionCalendarMonth === 11) {
      this.selectionCalendarMonth = 0;
      this.selectionCalendarYear += 1;
      return;
    }

    this.selectionCalendarMonth += 1;
  }

  toggleCalendarDaySelection(dateKey: string): void {
    if (this.isCalendarDayBlocked(dateKey)) {
      return;
    }

    if (this.selectedDaySessions[dateKey]) {
      const { [dateKey]: _, ...rest } = this.selectedDaySessions;
      this.selectedDaySessions = rest;
      return;
    }

    this.selectedDaySessions = {
      ...this.selectedDaySessions,
      [dateKey]: 'FULL'
    };
  }

  setSelectedDaySession(dateKey: string, session: LeaveDaySession): void {
    if (!this.selectedDaySessions[dateKey]) {
      return;
    }

    this.selectedDaySessions = {
      ...this.selectedDaySessions,
      [dateKey]: session
    };
  }

  removeSelectedDay(dateKey: string): void {
    const { [dateKey]: _, ...rest } = this.selectedDaySessions;
    this.selectedDaySessions = rest;
  }

  clearSelectedDays(): void {
    this.selectedDaySessions = {};
  }

  formatSelectedDate(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00`);
    return isNaN(date.getTime())
      ? dateKey
      : new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  getSessionLabel(session: LeaveDaySession): string {
    return session === 'FULL' ? 'Full day' : session === 'MORNING' ? 'Morning half' : 'Afternoon half';
  }

  isCalendarDayBlocked(dateKey: string): boolean {
    const date = new Date(`${dateKey}T00:00:00`);
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime()
      || day === 0
      || day === 6
      || this.holidays.some((holiday) => holiday.date === dateKey);
  }

  private isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    return day !== 0 && day !== 6 && !this.isHolidayDate(date);
  }

  private isHolidayDate(date: Date): boolean {
    const dateKey = this.toDateKey(date);
    return this.holidays.some((holiday) => holiday.date === dateKey);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private createDefaultModel(): LeaveFormModel {
    return {
      leaveTypeId: null,
      fromDate: '',
      toDate: '',
      reason: '',
      comments: '',
      durationType: 'FULL',
      halfDaySession: 'MORNING',
      notifyUserIds: []
    };
  }

  private populateForm(leave: AdminLeaveTableRow | null): void {
    this.submitted = false;
    this.model = this.createModelFromLeave(leave);
    this.selectedDaySessions = this.createDaySelectionsFromLeave(leave);
    this.syncSelectionCalendarToSelectedDays();
    this.leaveForm?.resetForm(this.model);
  }

  private createModelFromLeave(leave: AdminLeaveTableRow | null): LeaveFormModel {
    if (!leave) {
      return this.createDefaultModel();
    }

    return {
      leaveTypeId: leave.leaveTypeId,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      reason: leave.reason,
      comments: leave.comments,
      durationType: 'FULL',
      halfDaySession: 'MORNING',
      notifyUserIds: [...leave.notifyUserIds]
    };
  }

  private createDaySelectionsFromLeave(leave: AdminLeaveTableRow | null): Record<string, LeaveDaySession> {
    if (!leave) {
      return {};
    }

    const selected: Record<string, LeaveDaySession> = {};
    for (const ld of leave.leaveDates ?? []) {
      const session: LeaveDaySession =
        ld.dayType === 'MORNING_HALF' ? 'MORNING'
        : ld.dayType === 'AFTERNOON_HALF' ? 'AFTERNOON'
        : 'FULL';
      selected[ld.date] = session;
    }

    return selected;
  }

  private syncSelectionCalendarToSelectedDays(): void {
    const firstDate = this.selectedDaySelections[0]?.date;
    const source = firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();
    this.selectionCalendarMonth = source.getMonth();
    this.selectionCalendarYear = source.getFullYear();
  }
}
