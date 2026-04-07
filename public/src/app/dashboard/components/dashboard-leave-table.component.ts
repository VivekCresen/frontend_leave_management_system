import { CommonModule, DatePipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
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
  ModuleRegistry,
  PaginationModule,
  themeQuartz
} from 'ag-grid-community';

ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

export type AdminLeaveTableRow = {
  id: number;
  userId: number;
  leaveTypeId: number | null;
  fullName: string;
  emailId: string;
  role: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  createdAt: string | null;
  durationDays: number;
  status: string;
  approvedBy: string | null;
  rejectionReason: string | null;
  halfDay: boolean;
  halfDaySession: string | null;
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
  rowHeight: 72,
  headerHeight: 44,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-leave-table',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule, AgGridAngular],
  templateUrl: './dashboard-leave-table.component.html',
  styleUrls: ['./dashboard-leave-table.component.css']
})
export class DashboardLeaveTableComponent implements OnInit, AfterViewInit, OnChanges {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private gridApi: GridApi<AdminLeaveTableRow> | null = null;

  @Input({ required: true }) leaves: AdminLeaveTableRow[] = [];
  @Input() title = 'Team leave records';
  @Input() description = 'Review all leave requests created by managers and employees.';
  @Input() emptyTitle = 'No leave requests found';
  @Input() emptyMessage = 'Leave requests will appear here once managers or employees submit them.';
  @Input() initialRole = '';
  @Input() showActions = false;
  @Input() compactView = false;

  @Output() approveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() rejectRequested = new EventEmitter<{ leave: AdminLeaveTableRow; reason: string }>();

  searchTerm = '';
  selectedRole = 'ALL';
  selectedLeaveType = 'ALL';
  selectedStatus = 'PENDING';
  sortKey: keyof AdminLeaveTableRow = 'fromDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  currentPage = 1;
  pageSize = 6;
  rejectingLeave: AdminLeaveTableRow | null = null;
  rejectionReason = '';
  rejectionSubmitted = false;

  // AG Grid state
  gridMounted = false;
  readonly agTheme = leaveGridTheme;

  readonly defaultColDef: ColDef<AdminLeaveTableRow> = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressMovable: true
  };

  get columnDefs(): ColDef<AdminLeaveTableRow>[] {
    return [
      {
        headerName: 'Employee',
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
        headerName: 'Leave Type',
        field: 'leaveType',
        minWidth: 160,
        flex: 1.5,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) =>
          `<span class="ag-type-pill">${this.esc(value) || '—'}</span>`
      },
      {
        headerName: 'Date Range',
        field: 'fromDate',
        minWidth: 200,
        flex: 1.8,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) =>
          data ? `<div class="ag-date-cell">
            <strong>${this.fmtDate(data.fromDate)}</strong>
            <span>to ${this.fmtDate(data.toDate)}</span>
            <small>${data.halfDay ? '½ day — ' + (data.halfDaySession === 'MORNING' ? 'Morning' : 'Afternoon') : data.durationDays + ' day' + (data.durationDays !== 1 ? 's' : '')}</small>
          </div>` : ''
      },
      {
        headerName: 'Reason',
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
        headerName: 'Status',
        field: 'status',
        minWidth: 130,
        flex: 1,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const cls = (value ?? '').toLowerCase();
          const icons: Record<string, string> = { pending: 'fa-clock', approved: 'fa-circle-check', rejected: 'fa-circle-xmark' };
          return `<span class="ag-status-badge ag-status-${cls}">
            <i class="fas ${icons[cls] ?? 'fa-circle'}"></i>
            ${this.titleCase(value)}
          </span>`;
        }
      }
    ];
  }

  get agRowData(): AdminLeaveTableRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.leaves.filter(l => {
      const matchSearch = !term || [l.fullName, l.emailId, l.leaveType, l.reason, l.comments]
        .filter((v): v is string => !!v).some(v => v.toLowerCase().includes(term));
      const matchRole = this.selectedRole === 'ALL' || l.role === this.selectedRole;
      const matchType = this.selectedLeaveType === 'ALL' || l.leaveType === this.selectedLeaveType;
      const matchStatus = this.selectedStatus === 'ALL' || l.status === this.selectedStatus;
      return matchSearch && matchRole && matchType && matchStatus;
    });
  }

  ngOnInit(): void {
    if (this.initialRole) this.selectedRole = this.initialRole;
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.compactView) return;
    queueMicrotask(() => {
      this.gridMounted = true;
      this.cdr.detectChanges();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leaves'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.agRowData);
    }
  }

  onGridReady(event: GridReadyEvent<AdminLeaveTableRow>): void {
    this.gridApi = event.api;
  }

  onAgFilterChange(): void {
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.agRowData);
  }

  get statusOptions(): string[] {
    return ['PENDING'];
  }

  get roleOptions(): string[] {
    return Array.from(new Set(this.leaves.map(l => l.role).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  get leaveTypeOptions(): string[] {
    return Array.from(new Set(this.leaves.map(l => l.leaveType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  get agFilteredCount(): number {
    return this.agRowData.length;
  }

  get hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.selectedRole !== 'ALL' || this.selectedLeaveType !== 'ALL' || this.selectedStatus !== 'PENDING';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'ALL';
    this.selectedLeaveType = 'ALL';
    this.selectedStatus = 'PENDING';
    this.currentPage = 1;
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.agRowData);
  }

  // Legacy table methods
  get displayedLeaves(): AdminLeaveTableRow[] {
    const sorted = [...this.filteredLeaves].sort((a, b) => this.compareRows(a, b));
    const start = (this.currentPage - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  get filteredCount(): number { return this.filteredLeaves.length; }
  get totalPages(): number { return Math.ceil(this.filteredCount / this.pageSize); }
  get visibleCountLabel(): string { return `${this.compactView ? this.agFilteredCount : this.filteredCount} leave records`; }
  get resolvedEmptyTitle(): string { return this.hasActiveFilters ? 'No matching leave records' : this.emptyTitle; }
  get resolvedEmptyMessage(): string { return this.hasActiveFilters ? 'Try a different search term or reset the filters.' : this.emptyMessage; }

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

  onFilterChange(): void { this.currentPage = 1; }

  toggleSort(key: keyof AdminLeaveTableRow): void {
    if (this.sortKey === key) { this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; return; }
    this.sortKey = key;
    this.sortDirection = key === 'fromDate' || key === 'createdAt' ? 'desc' : 'asc';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  trackByLeaveId(_: number, leave: AdminLeaveTableRow): number { return leave.id; }

  private get filteredLeaves(): AdminLeaveTableRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.leaves.filter(leave => {
      const matchSearch = !term || [leave.fullName, leave.emailId, leave.leaveType, leave.reason, leave.comments]
        .filter((v): v is string => !!v).some(v => v.toLowerCase().includes(term));
      const matchRole = this.selectedRole === 'ALL' || leave.role === this.selectedRole;
      const matchType = this.selectedLeaveType === 'ALL' || leave.leaveType === this.selectedLeaveType;
      const matchStatus = this.selectedStatus === 'ALL' || leave.status === this.selectedStatus;
      return matchSearch && matchRole && matchType && matchStatus;
    });
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

  private fmtDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  private titleCase(value: unknown): string {
    return typeof value === 'string' && value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';
  }

  private esc(v: string | null | undefined): string {
    return (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
