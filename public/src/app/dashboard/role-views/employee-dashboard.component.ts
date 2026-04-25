import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DashboardPageId } from '../dashboard.config';
import { DashboardStatCard, DashboardStatCardsComponent } from '../components/dashboard-stat-cards.component';
import { LoginResponse, UserDashboardResponse } from '../../services/auth.service';
import { LeaveFormSubmitEvent } from '../components/dashboard-leave-form.component';
import { AdminLeaveTableRow } from '../components/dashboard-leave-table.component';
import { DashboardHistoryTableComponent } from '../components/dashboard-history-table.component';
import { LeaveType, NotifyUser, Holiday } from '../../services/leave.service';
import { CalendarBase } from '../components/calendar-base';
import { TranslateService, Language } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ThemeService } from '../../services/theme.service';

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
    FormsModule,
    DatePipe,
    TitleCasePipe,
    DashboardStatCardsComponent,
    DashboardHistoryTableComponent,
    TranslatePipe
  ],
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css']
})
export class EmployeeDashboardComponent extends CalendarBase implements OnChanges {
  readonly translateService = inject(TranslateService);
  readonly themeService = inject(ThemeService);
  @Input({ required: true }) pageId!: DashboardPageId;
  @Input({ required: true }) user!: LoginResponse;
  @Input() dashboard: UserDashboardResponse | null = null;
  @Input() leaveTypes: LeaveType[] = [];
  @Input() isLeaveFormOpen = false;
  @Input() isSaving = false;
  @Input() deletingLeaveId: number | null = null;
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
    const approvedDays = this.approvedLeaves.reduce((sum, l) => sum + (l.durationDays ?? 0), 0);
    const approvedDaysFmt = Number.isInteger(approvedDays) ? String(approvedDays) : approvedDays.toFixed(1);
    const t = (k: string, fb: string) => { const v = this.translateService.getTranslation(k); return v !== k ? v : fb; };

    return [
      {
        label: t('stats.profileRole', 'Profile role'),
        value: t('roles.employee', 'Employee'),
        note: t('stats.standardAccess', 'Standard user access.'),
        tone: 'teal',
        icon: 'fa-id-badge',
        route: ['/dashboard', 'profile'],
        actionLabel: t('stats.openProfile', 'Open profile')
      },
      {
        label: t('stats.accountStatus', 'Account status'),
        value: this.user.active ? t('stats.active', 'Active') : t('stats.inactive', 'Inactive'),
        note: t('stats.currentAccountState', 'Current account state.'),
        tone: this.user.active ? 'orange' : 'slate',
        icon: 'fa-circle-dot',
        route: ['/dashboard', 'profile'],
        actionLabel: t('stats.viewAccount', 'View account')
      },
      {
        label: t('stats.pendingRequests', 'Pending requests'),
        value: this.pendingLeaves.length,
        note: t('stats.awaitingApproval', 'Awaiting manager or admin approval.'),
        tone: 'orange',
        icon: 'fa-clock',
        route: ['/dashboard', 'requests'],
        actionLabel: t('stats.viewRequests', 'View requests')
      },
      {
        label: t('stats.approvedLeaveDays', 'Approved leave days'),
        value: approvedDaysFmt,
        note: t('stats.totalApprovedYear', 'Total days approved this year.'),
        tone: 'teal',
        icon: 'fa-calendar-check',
        route: ['/dashboard', 'history'],
        actionLabel: t('stats.viewHistory', 'View history')
      }
    ];
  }

  get pendingLeaves(): AdminLeaveTableRow[] {
    return this.myLeaves.filter((l) => l.status === 'PENDING' || l.status === 'MANAGER_APPROVED');
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

    return relevantTypes.map((leaveType) => {
      const takenDays = this.approvedLeaves
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
  calendarWeeks: EmpCalendarDay[][] = [];
  selectedDay: EmpCalendarDay | null = null;

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

  selectDay(day: EmpCalendarDay): void {
    this.selectedDay = (day.leaves.length > 0 || day.holidays.length > 0) ? day : null;
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

  protected buildCalendar(): void {
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isLangDropdownOpen = false;
  }
}
