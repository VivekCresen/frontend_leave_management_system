import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import { LoginResponse, UserDashboardResponse } from '../../services/auth.service';
import { LeaveFormSubmitEvent } from '../components/dashboard-leave-form.component';
import { AdminLeaveTableRow } from '../components/dashboard-leave-table.component';
import { DashboardHistoryTableComponent } from '../components/dashboard-history-table.component';
import { LeaveType, NotifyUser, Holiday } from '../../services/leave.service';

type EmpCalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  leaves: AdminLeaveTableRow[];
  holidays: Holiday[];
};

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    TitleCasePipe,
    DashboardStatCardsComponent,
    DashboardHistoryTableComponent
  ],
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})
export class EmployeeDashboardComponent implements OnChanges {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() leaveTypes: LeaveType[] = [];
  @Input() isLeaveFormOpen = false;
  @Input() isSaving = false;
  @Input() leaveFieldErrors: Record<string, string> = {};
  @Input() myLeaves: AdminLeaveTableRow[] = [];
  @Input() notifyUsers: NotifyUser[] = [];
  @Input() holidays: Holiday[] = [];

  @Output() openLeaveFormRequested = new EventEmitter<void>();
  @Output() leaveSubmitRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelLeaveFormRequested = new EventEmitter<void>();
  @Output() editProfileRequested = new EventEmitter<void>();
  @Output() editLeaveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() deleteLeaveRequested = new EventEmitter<AdminLeaveTableRow>();

  currentRequestsPage = 1;
  readonly requestsPageSize = 5;

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'Profile role',
        value: 'Employee',
        note: 'Standard user access.',
        tone: 'teal',
        icon: 'fa-id-badge',
        route: ['/dashboard', 'profile'],
        actionLabel: 'Open profile'
      },
      {
        label: 'Account status',
        value: this.user.active ? 'Active' : 'Inactive',
        note: 'Current account state.',
        tone: this.user.active ? 'orange' : 'slate',
        icon: 'fa-circle-dot',
        route: ['/dashboard', 'profile'],
        actionLabel: 'View account'
      },
      {
        label: 'Pending requests',
        value: this.pendingLeaves.length,
        note: 'Awaiting approval.',
        tone: 'orange',
        icon: 'fa-clock',
        route: ['/dashboard', 'requests'],
        actionLabel: 'View requests'
      },
      {
        label: 'Total requests',
        value: this.myLeaves.length,
        note: 'All submitted requests.',
        tone: 'slate',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'history'],
        actionLabel: 'View history'
      }
    ];
  }

  get pendingLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'PENDING');
  }

  get paginatedPendingLeaves(): AdminLeaveTableRow[] {
    const start = (this.currentRequestsPage - 1) * this.requestsPageSize;
    return this.pendingLeaves.slice(start, start + this.requestsPageSize);
  }

  get totalRequestPages(): number {
    return Math.max(1, Math.ceil(this.pendingLeaves.length / this.requestsPageSize));
  }

  get requestPageStart(): number {
    if (this.pendingLeaves.length === 0) return 0;
    return (this.currentRequestsPage - 1) * this.requestsPageSize + 1;
  }

  get requestPageEnd(): number {
    return Math.min(this.currentRequestsPage * this.requestsPageSize, this.pendingLeaves.length);
  }

  get approvedLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'APPROVED');
  }

  get rejectedLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'REJECTED');
  }

  get leaveByType(): { type: string; count: number; pct: number }[] {
    const map = new Map<string, number>();
    for (const leave of this.myLeaves) {
      map.set(leave.leaveType, (map.get(leave.leaveType) ?? 0) + 1);
    }
    const total = this.myLeaves.length || 1;
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  get profileInitials(): string {
    const name = this.dashboard?.actor?.fullName?.trim() || this.user.username?.trim() || 'U';
    const parts = name.split(/\s+/).filter((p) => p.length > 0);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
  }

  getNotifyUser(userId: number): NotifyUser | null {
    return this.notifyUsers.find((u) => u.id === userId) ?? null;
  }

  getUnknownNotifyCount(userIds: number[] | null | undefined): number {
    if (!userIds?.length) return 0;
    return userIds.filter((userId) => !this.getNotifyUser(userId)).length;
  }

  getInitials(fullName: string | null): string {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || fullName.slice(0, 2).toUpperCase();
  }

  // ── Calendar state ──────────────────────────────────────
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  calendarWeeks: EmpCalendarDay[][] = [];
  selectedDay: EmpCalendarDay | null = null;
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  jumpDate = '';   // bound to <input type="month">

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['myLeaves'] || changes['holidays']) {
      this.buildCalendar();
    }

    if (changes['myLeaves']) {
      this.currentRequestsPage = 1;
    }
  }

  goToRequestsPage(page: number): void {
    if (page < 1 || page > this.totalRequestPages) return;
    this.currentRequestsPage = page;
  }

  get calendarMonthLabel(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  get leavesThisMonth(): number {
    return this.myLeaves.filter((leave) => {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      return (
        from.getFullYear() <= this.calendarYear &&
        to.getFullYear() >= this.calendarYear &&
        from <= new Date(this.calendarYear, this.calendarMonth + 1, 0) &&
        to >= new Date(this.calendarYear, this.calendarMonth, 1)
      );
    }).length;
  }

  get holidaysThisMonth(): Holiday[] {
    return this.holidays
      .filter((holiday) => {
        const date = new Date(holiday.date);
        return date.getFullYear() === this.calendarYear && date.getMonth() === this.calendarMonth;
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
    else { this.calendarMonth--; }
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
    else { this.calendarMonth++; }
    this.buildCalendar();
  }

  goToToday(): void {
    const now = new Date();
    this.calendarYear = now.getFullYear();
    this.calendarMonth = now.getMonth();
    this.jumpDate = this.toMonthValue(this.calendarYear, this.calendarMonth);
    this.buildCalendar();
  }

  onJumpDateChange(value: string): void {
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    this.calendarYear = y;
    this.calendarMonth = m - 1;
    this.buildCalendar();
  }

  selectDay(day: EmpCalendarDay): void {
    this.selectedDay = (day.leaves.length > 0 || day.holidays.length > 0) ? day : null;
  }

  private buildCalendar(): void {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    const lastDay  = new Date(this.calendarYear, this.calendarMonth + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const weeks: EmpCalendarDay[][] = [];
    let week: EmpCalendarDay[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dayDate = new Date(cursor); dayDate.setHours(0, 0, 0, 0);

      const dayLeaves = this.myLeaves.filter(l => {
        const from = new Date(l.fromDate); from.setHours(0, 0, 0, 0);
        const to   = new Date(l.toDate);   to.setHours(0, 0, 0, 0);
        return dayDate >= from && dayDate <= to;
      });

      const dayHolidays = this.holidays.filter(h => {
        const hd = new Date(h.date); hd.setHours(0, 0, 0, 0);
        return hd.getTime() === dayDate.getTime();
      });

      week.push({
        date: new Date(cursor),
        isCurrentMonth: cursor.getMonth() === this.calendarMonth,
        isToday: cursor.getTime() === today.getTime(),
        leaves: dayLeaves,
        holidays: dayHolidays
      });

      if (week.length === 7) { weeks.push(week); week = []; }
      cursor.setDate(cursor.getDate() + 1);
    }

    this.calendarWeeks = weeks;
    this.selectedDay = null;
    this.jumpDate = this.toMonthValue(this.calendarYear, this.calendarMonth);
  }

  private toMonthValue(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}
