import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { DashboardHistoryTableComponent } from '../components/dashboard-history-table.component';
import { LeaveType, Holiday } from '../../services/leave.service';
import { CalendarBase } from '../components/calendar-base';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ThemeService } from '../../services/theme.service';

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  leaves: (AdminLeaveTableRow & { isOwn: boolean })[];
  holidays: Holiday[];
};

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    TitleCasePipe,
    DashboardStatCardsComponent,
    DashboardUserFormComponent,
    DashboardUserTableComponent,
    DashboardLeaveTableComponent,
    DashboardHistoryTableComponent,
    TranslatePipe
  ],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent extends CalendarBase implements OnChanges {
  readonly translateService = inject(TranslateService);
  readonly themeService = inject(ThemeService);
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() isUserFormOpen = false;
  @Input() deletingUserId: number | null = null;
  @Input() processingLeaveId: number | null = null;
  @Input() deletingLeaveId: number | null = null;
  @Input() fieldErrors: Record<string, string> = {};
  @Input() leaveTypes: LeaveType[] = [];
  @Input() isLeaveFormOpen = false;
  @Input() isLeaveSaving = false;
  @Input() leaveFieldErrors: Record<string, string> = {};
  @Input() managerLeaves: AdminLeaveTableRow[] = [];
  @Input() myLeaves: AdminLeaveTableRow[] = [];
  @Input() holidays: Holiday[] = [];

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
  @Output() leavePartialStatusRequested = new EventEmitter<{ leave: AdminLeaveTableRow; decisions: import('../../services/leave.service').DateDecision[]; rejectionReason?: string }>();
  @Output() editLeaveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() deleteLeaveRequested = new EventEmitter<AdminLeaveTableRow>();

  calendarWeeks: CalendarDay[][] = [];
  selectedDay: CalendarDay | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['managerLeaves'] || changes['myLeaves'] || changes['holidays']) {
      this.buildCalendar();
    }
  }

  selectDay(day: CalendarDay): void {
    this.selectedDay = day.leaves.length > 0 ? day : null;
  }

  protected buildCalendar(): void {
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
        leaves: dayLeaves,
        holidays: this.holidays.filter(h => {
          const hd = new Date(h.date); hd.setHours(0,0,0,0);
          return hd.getTime() === dayDate.getTime();
        })
      });

      if (week.length === 7) { weeks.push(week); week = []; }
      cursor.setDate(cursor.getDate() + 1);
    }

    this.calendarWeeks = weeks;
    this.selectedDay = null;
    this.jumpDate = this.toMonthValue(this.calendarYear, this.calendarMonth);
  }

  get stats(): DashboardStatCard[] {
    const t = (k: string, fb: string) => { const v = this.translateService.getTranslation(k); return v !== k ? v : fb; };
    return [
      {
        label: t('stats.myEmployees', 'My employees'),
        value: this.dashboard?.employeeCount ?? 0,
        note: t('stats.assignedToManager', 'Assigned to this manager.'),
        tone: 'teal',
        icon: 'fa-user-group',
        route: ['/dashboard', 'team'],
        actionLabel: t('stats.openTeam', 'Open team')
      },
      {
        label: t('stats.activeTeam', 'Active team'),
        value: this.dashboard?.activeUsers ?? 0,
        note: t('stats.currentlyActive', 'Currently active.'),
        tone: 'orange',
        icon: 'fa-circle-check',
        route: ['/dashboard', 'team'],
        actionLabel: t('stats.viewTeam', 'View team')
      },
      {
        label: t('stats.pendingApprovals', 'Pending approvals'),
        value: this.pendingLeaves.length,
        note: t('stats.awaitingDecision', 'Awaiting your decision.'),
        tone: 'orange',
        icon: 'fa-clock',
        route: ['/dashboard', 'approvals'],
        actionLabel: t('stats.reviewNow', 'Review now')
      },
      {
        label: t('stats.totalLeaveRequests', 'Total leave requests'),
        value: this.managerLeaves.length,
        note: t('stats.allTeamRequests', 'All team requests.'),
        tone: 'slate',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'approvals'],
        actionLabel: t('stats.openApprovals', 'Open approvals')
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

  get leaveBalanceCards(): DashboardStatCard[] {
    if (!this.leaveTypes || this.leaveTypes.length === 0) {
      return [];
    }
    const t = (k: string, fb: string) => { const v = this.translateService.getTranslation(k); return v !== k ? v : fb; };
    const userGender = this.dashboard?.actor?.gender?.toUpperCase() || '';
    const relevantTypes = this.leaveTypes.filter(lt => {
      if (!lt.genderRestriction) return true;
      if (!userGender) return true;
      return lt.genderRestriction.toUpperCase() === userGender;
    });

    const myApproved = this.myLeaves.filter(l => l.status === 'APPROVED');
    return relevantTypes.map((leaveType) => {
      const takenDays = myApproved
        .filter((l) => l.leaveTypeId === leaveType.id || l.leaveType === leaveType.leaveName)
        .reduce((sum, l) => sum + (l.durationDays ?? 0), 0);
      const remaining = Math.max(0, leaveType.maxDays - takenDays);
      const remainingFmt = Number.isInteger(remaining) ? String(remaining) : remaining.toFixed(1);
      const usedFmt = Number.isInteger(takenDays) ? String(takenDays) : takenDays.toFixed(1);
      const trKey = 'leaveTypes.' + (leaveType.leaveUniqueName || leaveType.leaveName);
      const translatedName = this.translateService.getTranslation(trKey) !== trKey ? this.translateService.getTranslation(trKey) : leaveType.leaveName;

      return {
        label: translatedName,
        value: `${remainingFmt} ${t('stats.available', 'available')}`,
        note: `${t('stats.used', 'Used')} ${usedFmt} ${t('stats.of', 'of')} ${leaveType.maxDays} ${t('stats.days', 'days')}`,
        tone: remaining > 0 ? 'teal' : 'orange',
        icon: 'fa-calendar-minus'
      };
    });
  }

  getInitials(name: string): string {
    const parts = (name || 'U').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
  }
}
