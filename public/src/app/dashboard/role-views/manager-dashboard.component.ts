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
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ThemeService } from '../../services/theme.service';
import { DashboardProfileComponent } from '../components/dashboard-profile.component';
import { DashboardAttendanceTableComponent } from '../components/dashboard-attendance-table.component';
import { AttendanceLogDto } from '../../services/auth.service';
import { LangSwitcherMixin } from '../../commons/lang-switcher.mixin';
import { computeLeaveBalanceCards, computeLeaveByType } from '../../commons/leave-balance.util';
import { getInitials } from '../../commons/string.util';

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
    DashboardProfileComponent,
    DashboardAttendanceTableComponent,
    TranslatePipe
  ],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css']
})
export class ManagerDashboardComponent extends LangSwitcherMixin implements OnChanges {
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
  @Input() myAttendanceLogs: AttendanceLogDto[] = [];
  @Input() isLeavesLoading = false;

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
  @Output() editProfileRequested = new EventEmitter<void>();

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
    return computeLeaveByType(this.managerLeaves);
  }

  get leaveBalanceCards(): DashboardStatCard[] {
    return computeLeaveBalanceCards(
      this.leaveTypes,
      this.myLeaves.filter(l => l.status === 'APPROVED'),
      this.dashboard?.actor?.gender ?? '',
      this.translateService
    );
  }

  getInitials(name: string): string {
    return getInitials(name);
  }
}
