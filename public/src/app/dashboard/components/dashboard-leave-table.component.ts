import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ClientSideRowModelModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  LocaleModule,
  ModuleRegistry,
  PaginationModule,
  themeQuartz
} from 'ag-grid-community';
import { DateDecision } from '../../services/leave.service';
import { LeaveProgressModalComponent } from './leave-progress-modal.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslateService } from '../../i18n/translate.service';
import { escHtml } from '../../commons/html.util';
import { formatDate } from '../../commons/date.util';
import { titleCase } from '../../commons/string.util';
import { DEFAULT_COL_DEF, mountAgGrid, syncGridOverlay, safeGoToPage } from '../../commons/ag-grid.util';
import { persistProgressLeave, restoreProgressLeave } from '../../commons/progress-leave.util';
import { filterByTerm, paginate, totalPages as calcTotalPages, uniqueFieldValues } from '../../commons/array.util';
import { buildDatesCellHtml, buildStatusBadgeHtml } from '../../commons/leave-session.util';

ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule, LocaleModule]);

export type AdminLeaveTableRow = {
  id: number;
  userId: number;
  leaveTypeId: number | null;
  fullName: string;
  emailId: string;
  role: string;
  leaveType: string;
  leaveDates: { date: string; dayType: string }[];
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  trail: string | null;
  createdAt: string | null;
  durationDays: number;
  status: string;
  approvedBy: string | null;
  managerApprovedBy: string | null;
  managerRejectedBy: string | null;
  managerApprovedAt: string | null;
  managerRejectedAt: string | null;
  adminApprovedBy: string | null;
  adminRejectedBy: string | null;
  adminApprovedAt: string | null;
  adminRejectedAt: string | null;
  rejectionReason: string | null;
  userDirectory: Record<string, string>;
  notifyUserIds: number[];
  editable: boolean;
};

const leaveGridTheme = themeQuartz.withParams({
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 14,
  headerBackgroundColor: 'rgba(248, 250, 252, 0.95)',
  headerTextColor: '#64748b',
  headerFontSize: 11,
  headerFontWeight: 800,
  borderColor: 'rgba(226, 232, 240, 0.8)',
  rowBorder: { color: 'rgba(226, 232, 240, 0.7)', width: 1 },
  oddRowBackgroundColor: 'rgba(248, 250, 252, 0.4)',
  rowHoverColor: 'rgba(15, 139, 141, 0.04)',
  selectedRowBackgroundColor: 'rgba(15, 139, 141, 0.08)',
  accentColor: '#0f8b8d',
  foregroundColor: '#0f172a',
  rowHeight: 100,
  headerHeight: 44,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-leave-table',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, LeaveProgressModalComponent, TranslatePipe],
  templateUrl: './dashboard-leave-table.component.html',
  styleUrls: ['./dashboard-leave-table.component.css']
})
export class DashboardLeaveTableComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private gridApi: GridApi<AdminLeaveTableRow> | null = null;
  private static readonly PROGRESS_STORAGE_KEY = 'leave_table_progress_leave_id';

  @Input() leaves: AdminLeaveTableRow[] = [];
  @Input() title = 'Team leave records';
  @Input() description = 'Review all leave requests created by managers and employees.';
  @Input() emptyTitle = 'No leave requests found';
  @Input() emptyMessage = 'Leave requests will appear here once managers or employees submit them.';
  @Input() initialRole = '';
  @Input() initialStatus = 'ALL';
  @Input() allowedStatuses: string[] = [];
  @Input() showStatusFilter = true;
  @Input() showActions = false;
  @Input() compactView = false;
  @Input() viewerRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | '' = '';
  @Input() processingLeaveId: number | null = null;
  @Input() isLoading = false;

  @Output() approveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() rejectRequested = new EventEmitter<{ leave: AdminLeaveTableRow; reason: string }>();
  @Output() partialStatusRequested = new EventEmitter<{ leave: AdminLeaveTableRow; decisions: DateDecision[]; rejectionReason?: string }>();

  searchTerm = '';
  selectedRole = 'ALL';
  selectedLeaveType = 'ALL';
  selectedStatus = 'ALL';
  sortKey: keyof AdminLeaveTableRow = 'fromDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  currentPage = 1;
  pageSize = 4;
  rejectingLeave: AdminLeaveTableRow | null = null;
  rejectionReason = '';
  rejectionSubmitted = false;

  partialLeave: AdminLeaveTableRow | null = null;
  partialDecisions: Record<string, 'APPROVED' | 'REJECTED'> = {};
  partialRejectionReason = '';
  partialSubmitted = false;

  gridMounted = false;
  readonly agTheme = leaveGridTheme;
  popupLeave: AdminLeaveTableRow | null = null;

  private _progressLeave: AdminLeaveTableRow | null = null;

  get progressLeave(): AdminLeaveTableRow | null {
    return this._progressLeave;
  }

  set progressLeave(value: AdminLeaveTableRow | null) {
    this._progressLeave = value;
    persistProgressLeave(this.platformId, DashboardLeaveTableComponent.PROGRESS_STORAGE_KEY, value);
  }

  constructor() {
    effect(() => {
      this.translate.currentLang(); // track signal
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.columnDefs);
        this.gridApi.setGridOption('rowData', this.agRowData);
      }
    });
  }

  readonly defaultColDef: ColDef<AdminLeaveTableRow> = DEFAULT_COL_DEF;

  get columnDefs(): ColDef<AdminLeaveTableRow>[] {
    const columns: ColDef<AdminLeaveTableRow>[] = [
      {
        headerName: this.translate.getTranslation('table.employee') !== 'table.employee' ? this.translate.getTranslation('table.employee') : 'Employee',
        field: 'fullName',
        minWidth: 200,
        flex: 2,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) =>
          data ? `<div class="ag-employee-cell">
            <strong>${this.esc(data.fullName)}</strong>
            <span>${this.esc(data.emailId)}</span>
          </div>` : ''
      },
      {
        headerName: this.translate.getTranslation('table.leaveType') !== 'table.leaveType' ? this.translate.getTranslation('table.leaveType') : 'Leave Type',
        field: 'leaveType',
        minWidth: 160,
        flex: 1.5,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const typeStr = value ? String(value) : '';
          const trKey = 'leaveTypes.' + typeStr;
          const translatedType = this.translate.getTranslation(trKey) !== trKey ? this.translate.getTranslation(trKey) : typeStr || '—';
          return `<span class="ag-type-pill">${this.esc(translatedType)}</span>`;
        }
      },
      {
        headerName: this.translate.getTranslation('table.dateRange') !== 'table.dateRange' ? this.translate.getTranslation('table.dateRange') : 'Selected Dates',
        field: 'fromDate',
        minWidth: 280,
        flex: 2.2,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          const dates = data.leaveDates ?? [];
          if (dates.length === 0) {
            if (data.fromDate && data.toDate) {
              const start = this.fmtDate(data.fromDate);
              const end = this.fmtDate(data.toDate);
              const text = start === end ? start : `${start} - ${end}`;
              const dur = data.durationDays || 0;
              const totalFmt = Number.isInteger(dur) ? `${dur}` : dur.toFixed(1);
              const summary = `<br><span style="color:#94a3b8;font-size:0.7rem;">${totalFmt} day${dur !== 1 ? 's' : ''}</span>`;
              return `<span style="font-size:0.82rem;font-weight:700;color:#0f172a;">📅 ${text}</span>${summary}`;
            }
            return '<span style="color:#94a3b8;">—</span>';
          }
          return buildDatesCellHtml(dates, data.id, (v) => this.fmtDate(v), (v) => this.esc(v));
        },
        onCellClicked: ({ data, event }) => {
          const target = event?.target as HTMLElement | null;
          if (target?.closest('[data-action="show-dates"]') && data) {
            this.popupLeave = data;
          }
        }
      },
      {
        headerName: this.translate.getTranslation('table.reason') !== 'table.reason' ? this.translate.getTranslation('table.reason') : 'Reason',
        field: 'reason',
        minWidth: 220,
        flex: 2,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) =>
          data ? `<div class="ag-reason-cell">
            <span>${this.esc(data.reason) || '—'}</span>
            ${data.comments ? `<small>${this.esc(data.comments)}</small>` : ''}
          </div>` : ''
      },
      {
        headerName: this.translate.getTranslation('table.status') !== 'table.status' ? this.translate.getTranslation('table.status') : 'Status',
        field: 'status',
        minWidth: 130,
        flex: 1,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const raw = (value ?? '') as string;
          const tKey = 'table.' + (raw === 'MANAGER_APPROVED' ? 'pending_admin' : raw.toLowerCase());
          const translated = this.translate.getTranslation(tKey);
          const label = translated !== tKey ? translated : (raw === 'MANAGER_APPROVED' ? 'Pending Admin' : titleCase(raw));
          return buildStatusBadgeHtml(raw, label);
        }
      },
      {
        headerName: this.translate.getTranslation('table.progress') !== 'table.progress' ? this.translate.getTranslation('table.progress') : 'Progress',
        minWidth: 170,
        flex: 1,
        sortable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: () => {
          const lKey = 'table.leaveProgress';
          const lbl = this.translate.getTranslation(lKey) !== lKey ? this.translate.getTranslation(lKey) : 'Leave Progress';
          return `<div class="ag-actions-cell" style="justify-content: flex-start;">
            <button type="button" class="ag-action-button track" data-action="track">
              <i class="fas fa-chart-line"></i> ${lbl}
            </button>
          </div>`;
        },
        onCellClicked: ({ data, event }) => {
          if (!data) return;
          const target = event?.target as HTMLElement | null;
          if (target?.closest('[data-action="track"]')) {
            this.progressLeave = data;
          }
        }
      }
    ];

    if (this.showActions) {
      columns.push({
        headerName: this.translate.getTranslation('table.actions') !== 'table.actions' ? this.translate.getTranslation('table.actions') : 'Actions',
        minWidth: 230,
        flex: 1.6,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) {
            return '';
          }

          const actions: string[] = [];

          if (data.status === 'PENDING' || (data.status === 'MANAGER_APPROVED' && this.viewerRole === 'ADMIN')) {
            const trReview = this.translate.getTranslation('table.reviewDates');
            const trFinal = this.translate.getTranslation('table.finalDecision');
            const trProcess = this.translate.getTranslation('table.processing');
            const lblReview = trReview !== 'table.reviewDates' ? trReview : 'Review Dates';
            const lblFinal = trFinal !== 'table.finalDecision' ? trFinal : 'Final Decision';
            const lblProcessing = trProcess !== 'table.processing' ? trProcess : 'Processing';
            const label = data.status === 'MANAGER_APPROVED'
              ? '<i class="fas fa-shield-halved"></i> ' + lblFinal
              : '<i class="fas fa-list-check"></i> ' + lblReview;
            const processing = this.processingLeaveId === data.id;
            const buttonContent = processing ? lblProcessing : label;

            actions.push(
              `<button type="button" class="ag-action-button partial${data.status === 'MANAGER_APPROVED' ? ' admin-final' : ''}${processing ? ' is-loading' : ''}" data-action="partial" ${processing ? 'disabled' : ''}>${buttonContent}</button>`
            );
          } else if (data.status === 'MANAGER_APPROVED' && this.viewerRole !== 'ADMIN') {
            const trPending = this.translate.getTranslation('table.pending_admin');
            const lbl = trPending !== 'table.pending_admin' ? trPending : 'Pending admin';
            actions.push(`<span class="ag-action-muted">${lbl}</span>`);
          }

          return `<div class="ag-actions-cell">${actions.join('')}</div>`;
        },
        onCellClicked: ({ data, event }) => {
          if (!data) {
            return;
          }

          const target = event?.target as HTMLElement | null;
          const action = target?.closest('[data-action]')?.getAttribute('data-action');

          if (action === 'partial' && this.processingLeaveId !== data.id) {
            this.openPartialModal(data);
          }
        }
      });
    }

    return columns;
  }

  get agRowData(): AdminLeaveTableRow[] {
    const byTerm = filterByTerm(this.leaves, this.searchTerm, ['fullName', 'emailId', 'leaveType', 'reason', 'comments']);
    return byTerm.filter(l => {
      const matchRole = this.selectedRole === 'ALL' || l.role === this.selectedRole;
      const matchType = this.selectedLeaveType === 'ALL' || l.leaveType === this.selectedLeaveType;
      const matchStatus = this.selectedStatus === 'ALL' || l.status === this.selectedStatus;
      return matchRole && matchType && matchStatus;
    });
  }

  ngOnInit(): void {
    if (this.initialRole) this.selectedRole = this.initialRole;
    this.selectedStatus = this.resolvedInitialStatus;
    this.restoreProgressLeave();
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.compactView) return;
    mountAgGrid(() => { this.gridMounted = true; this.cdr.detectChanges(); });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialStatus'] && !changes['initialStatus'].firstChange) {
      this.selectedStatus = this.resolvedInitialStatus;
    }

    if ((changes['allowedStatuses'] || changes['showActions'] || changes['viewerRole'] || changes['processingLeaveId']) && this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }

    if (changes['leaves'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.agRowData);
      if (!this.isLoading) this.gridApi.hideOverlay();
    }

    if (changes['leaves'] && this.leaves.length > 0 && !this._progressLeave) {
      this.restoreProgressLeave();
    }

    if (changes['isLoading'] && this.gridApi) syncGridOverlay(this.gridApi, this.isLoading);
  }

  onGridReady(event: GridReadyEvent<AdminLeaveTableRow>): void {
    this.gridApi = event.api;
  }

  ngOnDestroy(): void {
  }

  private restoreProgressLeave(): void {
    const found = restoreProgressLeave(this.platformId, DashboardLeaveTableComponent.PROGRESS_STORAGE_KEY, this.leaves);
    if (found) this._progressLeave = found;
  }

  onAgFilterChange(): void {
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.agRowData);
  }

  get statusOptions(): string[] {
    const unique = this.allowedStatuses.length
      ? this.allowedStatuses
      : Array.from(new Set(this.leaves.map((leave) => leave.status).filter(Boolean)));

    const ordered = ['PENDING', 'APPROVED', 'REJECTED'];
    return [...unique].sort((a, b) => {
      const ai = ordered.indexOf(a);
      const bi = ordered.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  get roleOptions(): string[] {
    return uniqueFieldValues(this.leaves, 'role');
  }

  get leaveTypeOptions(): string[] {
    return uniqueFieldValues(this.leaves, 'leaveType');
  }

  get agFilteredCount(): number {
    return this.agRowData.length;
  }

  get hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0
      || this.selectedRole !== 'ALL'
      || this.selectedLeaveType !== 'ALL'
      || (this.showStatusFilter && this.selectedStatus !== this.resolvedInitialStatus);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'ALL';
    this.selectedLeaveType = 'ALL';
    this.selectedStatus = this.resolvedInitialStatus;
    this.currentPage = 1;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.agRowData);
  }

  get displayedLeaves(): AdminLeaveTableRow[] {
    const sorted = [...this.filteredLeaves].sort((a, b) => this.compareRows(a, b));
    return paginate(sorted, this.currentPage, this.pageSize);
  }

  get filteredCount(): number { return this.filteredLeaves.length; }
  get totalPages(): number { return calcTotalPages(this.filteredCount, this.pageSize); }
  get visibleCountLabel(): string { return `${this.compactView ? this.agFilteredCount : this.filteredCount} leave records`; }
  get resolvedEmptyTitle(): string { return this.hasActiveFilters ? this.translate.getTranslation('tableActions.noMatchingLeave') : this.emptyTitle; }
  get resolvedEmptyMessage(): string { return this.hasActiveFilters ? this.translate.getTranslation('tableActions.tryDifferentSearch') : this.emptyMessage; }

  get agLocaleText(): Record<string, string> {
    if (this.agFilteredCount === 0) {
      return {
        to: '–',
        of: '0',
        page: 'Page',
        nextPage: 'Next',
        lastPage: 'Last',
        firstPage: 'First',
        previousPage: 'Previous',
        pageSizeSelectorLabel: 'Page Size:',
      };
    }
    return {
      to: 'to',
      of: 'of',
      page: 'Page',
      nextPage: 'Next',
      lastPage: 'Last',
      firstPage: 'First',
      previousPage: 'Previous',
      pageSizeSelectorLabel: 'Page Size:',
    };
  }

  approve(leave: AdminLeaveTableRow): void { this.approveRequested.emit(leave); }

  openRejectModal(leave: AdminLeaveTableRow): void {
    this.rejectingLeave = leave; this.rejectionReason = ''; this.rejectionSubmitted = false;
  }

  confirmReject(): void {
    this.rejectionSubmitted = true;
    if (!this.rejectionReason.trim() || !this.rejectingLeave) return;
    this.rejectRequested.emit({ leave: this.rejectingLeave, reason: this.rejectionReason.trim() });
    this.closeRejectModal();
  }

  closeRejectModal(): void {
    this.rejectingLeave = null; this.rejectionReason = ''; this.rejectionSubmitted = false;
  }

  openPartialModal(leave: AdminLeaveTableRow): void {
    this.partialLeave = leave;
    this.partialDecisions = {};
    this.partialRejectionReason = '';
    this.partialSubmitted = false;
    for (const d of leave.leaveDates) {
      this.partialDecisions[this.dateKey(d.date, d.dayType)] = 'APPROVED';
    }
  }

  closePartialModal(): void {
    this.partialLeave = null;
    this.partialDecisions = {};
    this.partialRejectionReason = '';
    this.partialSubmitted = false;
  }

  togglePartialDecision(date: string, dayType: string): void {
    const key = this.dateKey(date, dayType);
    this.partialDecisions[key] = this.partialDecisions[key] === 'APPROVED' ? 'REJECTED' : 'APPROVED';
  }

  setAllPartialDecisions(status: 'APPROVED' | 'REJECTED'): void {
    if (!this.partialLeave || this.hasMixedPartialDecisions) return;
    for (const d of this.partialLeave.leaveDates) {
      this.partialDecisions[this.dateKey(d.date, d.dayType)] = status;
    }
  }

  getPartialDecision(date: string, dayType: string): 'APPROVED' | 'REJECTED' {
    return this.partialDecisions[this.dateKey(date, dayType)] ?? 'APPROVED';
  }

  get areAllPartialApproved(): boolean {
    return !!this.partialLeave
      && this.partialLeave.leaveDates.every(d => this.getPartialDecision(d.date, d.dayType) === 'APPROVED');
  }

  get areAllPartialRejected(): boolean {
    return !!this.partialLeave
      && this.partialLeave.leaveDates.every(d => this.getPartialDecision(d.date, d.dayType) === 'REJECTED');
  }

  get hasMixedPartialDecisions(): boolean {
    return this.hasAnyRejected && !this.areAllPartialRejected;
  }

  get hasAnyRejected(): boolean {
    return Object.values(this.partialDecisions).some(v => v === 'REJECTED');
  }

  confirmPartial(): void {
    this.partialSubmitted = true;
    if (!this.partialLeave) return;
    if (this.processingLeaveId === this.partialLeave.id) return;
    if (this.hasAnyRejected && !this.partialRejectionReason.trim()) return;

    const decisions: DateDecision[] = this.partialLeave.leaveDates.map(d => ({
      date: d.date,
      dayType: d.dayType,
      status: this.getPartialDecision(d.date, d.dayType)
    }));

    this.partialStatusRequested.emit({
      leave: this.partialLeave,
      decisions,
      rejectionReason: this.hasAnyRejected ? this.partialRejectionReason.trim() : undefined
    });
    this.closePartialModal();
  }

  private dateKey(date: string, dayType: string): string {
    return `${date}|${dayType ?? 'FULL'}`;
  }

  onFilterChange(): void { this.currentPage = 1; }

  toggleSort(key: keyof AdminLeaveTableRow): void {
    if (this.sortKey === key) { this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; return; }
    this.sortKey = key;
    this.sortDirection = key === 'fromDate' || key === 'createdAt' ? 'desc' : 'asc';
  }

  goToPage(page: number): void {
    safeGoToPage(page, this.totalPages, (p) => { this.currentPage = p; });
  }

  trackByLeaveId(_: number, leave: AdminLeaveTableRow): number { return leave.id; }

  private get filteredLeaves(): AdminLeaveTableRow[] {
    const byTerm = filterByTerm(this.leaves, this.searchTerm, ['fullName', 'emailId', 'leaveType', 'reason', 'comments']);
    return byTerm.filter(leave => {
      const matchRole = this.selectedRole === 'ALL' || leave.role === this.selectedRole;
      const matchType = this.selectedLeaveType === 'ALL' || leave.leaveType === this.selectedLeaveType;
      const matchStatus = this.selectedStatus === 'ALL' || leave.status === this.selectedStatus;
      return matchRole && matchType && matchStatus;
    });
  }

  private get resolvedInitialStatus(): string {
    const requestedStatus = (this.initialStatus || 'ALL').toUpperCase();
    const allowedStatusSet = new Set(this.statusOptions);
    return requestedStatus === 'ALL' || allowedStatusSet.has(requestedStatus) ? requestedStatus : 'ALL';
  }

  private compareRows(a: AdminLeaveTableRow, b: AdminLeaveTableRow): number {
    const av = this.resolveSortValue(a, this.sortKey);
    const bv = this.resolveSortValue(b, this.sortKey);
    if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
    if (av > bv) return this.sortDirection === 'asc' ? 1 : -1;
    return 0;
  }

  private resolveSortValue(row: AdminLeaveTableRow, key: keyof AdminLeaveTableRow): number | string {
    const value = row[key];
    if (key === 'fromDate' || key === 'createdAt') return value ? new Date(value as string).getTime() : 0;
    if (typeof value === 'number') return value;
    return (value ?? '').toString().toLowerCase();
  }

  fmtDatePublic(value: string | number[] | unknown): string {
    return formatDate(value);
  }

  private fmtDate = formatDate;
  private esc = escHtml;
}
