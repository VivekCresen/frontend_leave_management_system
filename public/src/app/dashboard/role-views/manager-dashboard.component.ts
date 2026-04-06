import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import {
  DashboardUserFormComponent,
  DashboardUserSubmitEvent
} from '../components/dashboard-user-form.component';
import { DashboardUserTableComponent } from '../components/dashboard-user-table.component';
import { LoginResponse, ManagedUser, UserDashboardResponse } from '../../services/auth.service';
import { LeaveFormSubmitEvent } from '../components/dashboard-leave-form.component';
import { AdminLeaveTableRow, DashboardLeaveTableComponent } from '../components/dashboard-leave-table.component';
import { LeaveType } from '../../services/leave.service';

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  leaves: (AdminLeaveTableRow & { isOwn: boolean })[];
};

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    TitleCasePipe,
    DashboardStatCardsComponent,
    DashboardUserFormComponent,
    DashboardUserTableComponent,
    DashboardLeaveTableComponent
  ],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent implements OnChanges {
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() isUserFormOpen = false;
  @Input() fieldErrors: Record<string, string> = {};
  @Input() leaveTypes: LeaveType[] = [];
  @Input() isLeaveFormOpen = false;
  @Input() isLeaveSaving = false;
  @Input() leaveFieldErrors: Record<string, string> = {};
  @Input() managerLeaves: AdminLeaveTableRow[] = [];
  @Input() myLeaves: AdminLeaveTableRow[] = [];

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() createRequested = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() cancelEditRequested = new EventEmitter<void>();
  @Output() openLeaveFormRequested = new EventEmitter<void>();
  @Output() leaveSubmitRequested = new EventEmitter<LeaveFormSubmitEvent>();
  @Output() cancelLeaveFormRequested = new EventEmitter<void>();
  @Output() leaveApproveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() leaveRejectRequested = new EventEmitter<{ leave: AdminLeaveTableRow; reason: string }>();

  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  calendarWeeks: CalendarDay[][] = [];
  selectedDay: CalendarDay | null = null;
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['managerLeaves'] || changes['myLeaves']) {
      this.buildCalendar();
    }
  }

  get calendarMonthLabel(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
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
    this.buildCalendar();
  }

  selectDay(day: CalendarDay): void {
    this.selectedDay = day.leaves.length > 0 ? day : null;
  }

  private buildCalendar(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth + 1, 0);

    const allLeaves: (AdminLeaveTableRow & { isOwn: boolean })[] = [
      ...this.managerLeaves.map(l => ({ ...l, isOwn: false })),
      ...this.myLeaves
        .filter(l => !this.managerLeaves.some(m => m.id === l.id))
        .map(l => ({ ...l, isOwn: true }))
    ];

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const weeks: CalendarDay[][] = [];
    let week: CalendarDay[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dayDate = new Date(cursor);
      dayDate.setHours(0, 0, 0, 0);

      const dayLeaves = allLeaves.filter(l => {
        const from = new Date(l.fromDate); from.setHours(0, 0, 0, 0);
        const to = new Date(l.toDate); to.setHours(0, 0, 0, 0);
        return dayDate >= from && dayDate <= to;
      });

      week.push({
        date: new Date(cursor),
        isCurrentMonth: cursor.getMonth() === this.calendarMonth,
        isToday: cursor.getTime() === today.getTime(),
        leaves: dayLeaves
      });

      if (week.length === 7) { weeks.push(week); week = []; }
      cursor.setDate(cursor.getDate() + 1);
    }

    this.calendarWeeks = weeks;
    this.selectedDay = null;
  }

  get stats(): DashboardStatCard[] {
    return [
      {
        label: 'My employees',
        value: this.dashboard?.employeeCount ?? 0,
        note: 'Assigned to this manager.',
        tone: 'teal',
        icon: 'fa-user-group',
        route: ['/dashboard', 'team'],
        actionLabel: 'Open team'
      },
      {
        label: 'Active team',
        value: this.dashboard?.activeUsers ?? 0,
        note: 'Currently active.',
        tone: 'orange',
        icon: 'fa-circle-check',
        route: ['/dashboard', 'team'],
        actionLabel: 'View team'
      },
      {
        label: 'Pending approvals',
        value: this.pendingLeaves.length,
        note: 'Awaiting your decision.',
        tone: 'orange',
        icon: 'fa-clock',
        route: ['/dashboard', 'approvals'],
        actionLabel: 'Review now'
      },
      {
        label: 'Total leave requests',
        value: this.managerLeaves.length,
        note: 'All team requests.',
        tone: 'slate',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'approvals'],
        actionLabel: 'Open approvals'
      }
    ];
  }

  get pendingLeaves(): AdminLeaveTableRow[] {
    return this.managerLeaves.filter((l) => l.status === 'PENDING');
  }

  get approvedLeaves(): AdminLeaveTableRow[] {
    return this.managerLeaves.filter((l) => l.status === 'APPROVED');
  }

  get rejectedLeaves(): AdminLeaveTableRow[] {
    return this.managerLeaves.filter((l) => l.status === 'REJECTED');
  }

  get leaveByType(): { type: string; count: number; pct: number }[] {
    const map = new Map<string, number>();
    for (const leave of this.managerLeaves) {
      map.set(leave.leaveType, (map.get(leave.leaveType) ?? 0) + 1);
    }
    const total = this.managerLeaves.length || 1;
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  getInitials(name: string): string {
    const parts = (name || 'U').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
  }
}
