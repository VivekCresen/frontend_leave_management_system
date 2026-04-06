import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type AdminLeaveTableRow = {
  id: number;
  userId: number;
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
};

@Component({
  selector: 'app-dashboard-leave-table',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule],
  templateUrl: './dashboard-leave-table.component.html',
  styleUrls: ['./dashboard-leave-table.component.css']
})
export class DashboardLeaveTableComponent implements OnInit {
  @Input({ required: true }) leaves: AdminLeaveTableRow[] = [];
  @Input() title = 'Team leave records';
  @Input() description = 'Review all leave requests created by managers and employees.';
  @Input() emptyTitle = 'No leave requests found';
  @Input() emptyMessage = 'Leave requests will appear here once managers or employees submit them.';
  @Input() initialRole = '';
  @Input() showActions = false;

  @Output() approveRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() rejectRequested = new EventEmitter<{ leave: AdminLeaveTableRow; reason: string }>();

  searchTerm = '';
  selectedRole = 'ALL';
  selectedLeaveType = 'ALL';
  selectedStatus = 'ALL';
  sortKey: keyof AdminLeaveTableRow = 'fromDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  currentPage = 1;
  pageSize = 6;

  rejectingLeave: AdminLeaveTableRow | null = null;
  rejectionReason = '';
  rejectionSubmitted = false;

  ngOnInit(): void {
    if (this.initialRole) this.selectedRole = this.initialRole;
  }

  get statusOptions(): string[] {
    return ['PENDING', 'APPROVED', 'REJECTED'];
  }

  get roleOptions(): string[] {
    return Array.from(new Set(this.leaves.map((leave) => leave.role).filter((role) => !!role))).sort((left, right) =>
      left.localeCompare(right)
    );
  }

  get leaveTypeOptions(): string[] {
    return Array.from(new Set(this.leaves.map((leave) => leave.leaveType).filter((type) => !!type))).sort((left, right) =>
      left.localeCompare(right)
    );
  }

  get displayedLeaves(): AdminLeaveTableRow[] {
    const filtered = this.filteredLeaves;
    const sorted = [...filtered].sort((left, right) => this.compareRows(left, right));
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return sorted.slice(startIndex, startIndex + this.pageSize);
  }

  get filteredCount(): number {
    return this.filteredLeaves.length;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredCount / this.pageSize);
  }

  get hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.selectedRole !== 'ALL' || this.selectedLeaveType !== 'ALL' || this.selectedStatus !== 'ALL';
  }

  get visibleCountLabel(): string {
    return `${this.filteredCount} leave records`;
  }

  get resolvedEmptyTitle(): string {
    return this.hasActiveFilters ? 'No matching leave records' : this.emptyTitle;
  }

  get resolvedEmptyMessage(): string {
    return this.hasActiveFilters ? 'Try a different search term or reset the filters.' : this.emptyMessage;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'ALL';
    this.selectedLeaveType = 'ALL';
    this.selectedStatus = 'ALL';
    this.currentPage = 1;
  }

  approve(leave: AdminLeaveTableRow): void {
    this.approveRequested.emit(leave);
  }

  openRejectModal(leave: AdminLeaveTableRow): void {
    this.rejectingLeave = leave;
    this.rejectionReason = '';
    this.rejectionSubmitted = false;
  }

  confirmReject(): void {
    this.rejectionSubmitted = true;
    if (!this.rejectionReason.trim() || !this.rejectingLeave) return;
    this.rejectRequested.emit({ leave: this.rejectingLeave, reason: this.rejectionReason.trim() });
    this.closeRejectModal();
  }

  closeRejectModal(): void {
    this.rejectingLeave = null;
    this.rejectionReason = '';
    this.rejectionSubmitted = false;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  toggleSort(key: keyof AdminLeaveTableRow): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDirection = key === 'fromDate' || key === 'createdAt' ? 'desc' : 'asc';
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  trackByLeaveId(_: number, leave: AdminLeaveTableRow): number {
    return leave.id;
  }

  private get filteredLeaves(): AdminLeaveTableRow[] {
    const searchTerm = this.searchTerm.trim().toLowerCase();

    return this.leaves.filter((leave) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        [leave.fullName, leave.emailId, leave.leaveType, leave.reason, leave.comments]
          .filter((value): value is string => !!value)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesRole = this.selectedRole === 'ALL' || leave.role === this.selectedRole;
      const matchesLeaveType = this.selectedLeaveType === 'ALL' || leave.leaveType === this.selectedLeaveType;
      const matchesStatus = this.selectedStatus === 'ALL' || leave.status === this.selectedStatus;

      return matchesSearch && matchesRole && matchesLeaveType && matchesStatus;
    });
  }

  private compareRows(left: AdminLeaveTableRow, right: AdminLeaveTableRow): number {
    const leftValue = this.resolveSortValue(left, this.sortKey);
    const rightValue = this.resolveSortValue(right, this.sortKey);

    if (leftValue < rightValue) {
      return this.sortDirection === 'asc' ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return this.sortDirection === 'asc' ? 1 : -1;
    }

    return 0;
  }

  private resolveSortValue(row: AdminLeaveTableRow, key: keyof AdminLeaveTableRow): number | string {
    const value = row[key];

    if (key === 'fromDate' || key === 'createdAt') {
      return value ? new Date(value).getTime() : 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    return (value ?? '').toString().toLowerCase();
  }
}
