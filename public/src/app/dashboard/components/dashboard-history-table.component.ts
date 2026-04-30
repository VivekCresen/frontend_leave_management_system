import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { LeaveProgressModalComponent } from './leave-progress-modal.component';
import { AdminLeaveTableRow } from './dashboard-leave-table.component';
import { LeaveType } from '../../services/leave.service';
import { TranslateService } from '../../i18n/translate.service';
import { formatDate } from '../../commons/date.util';
import { titleCase } from '../../commons/string.util';

@Component({
  selector: 'app-dashboard-history-table',
  standalone: true,
  imports: [CommonModule, LeaveProgressModalComponent],
  template: `
<section class="table-card">
  <div class="table-heading">
    <div>
      <p class="eyebrow">{{ translate.getTranslation('tableActions.leaveHistory') }}</p>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <span class="count-pill">{{ leaves.length }} record{{ leaves.length !== 1 ? 's' : '' }}</span>
  </div>

  <div *ngIf="isLoading && leaves.length === 0" class="empty-state loading-state">
    <h4>{{ translate.getTranslation('tableActions.loadingHistory') || 'Loading leave history...' }}</h4>
    <p>{{ translate.getTranslation('tableActions.loadingHistoryDesc') || 'Please wait while we fetch your records.' }}</p>
  </div>

  <div *ngIf="!isLoading && leaves.length === 0" class="empty-state">
    <h4>{{ translate.getTranslation('tableActions.noLeaveHistory') }}</h4>
    <p>{{ translate.getTranslation('tableActions.submitFirstLeave') }}</p>
  </div>

  <div *ngIf="leaves.length > 0" class="table-shell">
    <table class="history-table">
      <thead>
        <tr>
          <th>Leave type</th>
          <th>Selected dates</th>
          <th>Days</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Manager</th>
          <th>Admin</th>
          <th>Progress &amp; Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let leave of leaves">
          <td>
            <strong>{{ translateLeaveType(leave.leaveType) }}</strong>
            <div class="secondary-text">{{ leave.role }}</div>
          </td>
          <td class="cell-dates">
            <div>{{ fmtDate(leave.fromDate) }} – {{ fmtDate(leave.toDate) }}</div>
            <button type="button" class="link-button" (click)="openDatesPopup(leave)">View dates</button>
          </td>
          <td class="cell-center">{{ formatDuration(leave.durationDays) }}</td>
          <td class="cell-reason">{{ leave.reason || '—' }}</td>
          <td class="cell-center">
            <span class="status-pill" [ngClass]="statusClass(leave.status)">{{ formatStatusLabel(leave.status) }}</span>
          </td>
          <td>{{ formatDecision(leave.managerApprovedBy, leave.managerRejectedBy, leave.userDirectory) }}</td>
          <td>{{ formatAdminDecision(leave.adminApprovedBy, leave.adminRejectedBy, leave.status, leave.managerRejectedBy, leave.userDirectory) }}</td>
          <td class="cell-actions">
            <button type="button" class="small-button progress" (click)="showProgress(leave)">
              {{ translate.getTranslation('tableActions.track') || 'Track' }}
            </button>
            <ng-container *ngIf="showRequestActions">
              <ng-container *ngIf="leave.editable && leave.status === 'PENDING'; else noAction">
                <button type="button" class="small-button" (click)="handleEdit(leave)">
                  {{ translate.getTranslation('tableActions.edit') || 'Edit' }}
                </button>
                <button
                  type="button"
                  class="small-button delete"
                  (click)="handleDelete(leave)"
                  [disabled]="deletingLeaveId === leave.id">
                  {{ deletingLeaveId === leave.id ? (translate.getTranslation('tableActions.deleting') || 'Deleting...') : (translate.getTranslation('tableActions.delete') || 'Delete') }}
                </button>
              </ng-container>
              <ng-template #noAction></ng-template>
            </ng-container>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<app-leave-progress-modal
  *ngIf="progressLeave"
  [leave]="progressLeave"
  (closed)="progressLeave = null">
</app-leave-progress-modal>

<div *ngIf="popupLeave" class="dates-popup-backdrop" (click)="popupLeave = null">
  <div class="dates-popup-card" (click)="$event.stopPropagation()">
    <div class="dates-popup-header">
      <div>
        <p class="dates-popup-eyebrow">{{ popupLeave.leaveType }}</p>
        <h3>{{ translate.getTranslation('tableActions.allSelectedDates') }}</h3>
      </div>
      <button type="button" class="dates-popup-close" (click)="popupLeave = null" aria-label="Close">✕</button>
    </div>
    <div class="dates-popup-list">
      <div *ngFor="let d of popupLeave.leaveDates" class="dates-popup-row">
        <span class="dates-popup-icon">{{ d.dayType === 'MORNING_HALF' ? '🌅' : d.dayType === 'AFTERNOON_HALF' ? '🌇' : '📅' }}</span>
        <strong class="dates-popup-date">{{ fmtDate(d.date) }}</strong>
        <span class="dates-popup-session"
          [class.session-morning]="d.dayType === 'MORNING_HALF'"
          [class.session-afternoon]="d.dayType === 'AFTERNOON_HALF'"
          [class.session-full]="!d.dayType || d.dayType === 'FULL'">
          {{ d.dayType === 'MORNING_HALF' ? translate.getTranslation('tableActions.morningHalf') : d.dayType === 'AFTERNOON_HALF' ? translate.getTranslation('tableActions.afternoonHalf') : translate.getTranslation('tableActions.fullDay') }}
        </span>
      </div>
    </div>
    <div class="dates-popup-footer">
      {{ popupLeave.leaveDates.length }} date{{ popupLeave.leaveDates.length !== 1 ? 's' : '' }}
      &nbsp;·&nbsp;
      {{ popupLeave.durationDays % 1 === 0 ? popupLeave.durationDays : popupLeave.durationDays.toFixed(1) }} day{{ popupLeave.durationDays !== 1 ? 's' : '' }} total
    </div>
  </div>
</div>
  `,
  styles: [
`    .table-card {
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 20px;
      background: #ffffff;
      padding: 16px 20px 14px;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06), 0 12px 40px -20px rgba(15, 23, 42, 0.14);
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .table-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.85);
    }
    .eyebrow {
      margin: 0;
      color: #0f8b8d;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .table-heading h3,
    .table-heading p { margin: 0; }
    .table-heading h3 {
      margin-top: 2px;
      color: #0f172a;
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .table-heading > div > p:last-child {
      margin-top: 4px;
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .count-pill {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(15, 139, 141, 0.2);
      background: rgba(15, 139, 141, 0.08);
      color: #0f766e;
      font-size: 0.8rem;
      font-weight: 800;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .empty-state {
      margin-top: 24px;
      padding: 32px;
      border-radius: 16px;
      border: 1.5px dashed rgba(148, 163, 184, 0.45);
      text-align: center;
      background: rgba(248, 250, 252, 0.6);
    }
    .empty-state h4,
    .empty-state p { margin: 0; }
    .empty-state h4 {
      color: #0f172a;
      font-size: 1.05rem;
      font-weight: 700;
    }
    .empty-state p {
      margin-top: 8px;
      color: #64748b;
      line-height: 1.6;
      font-size: 0.9rem;
    }
    .loading-state { border-style: solid; }
    .table-shell {
      margin-top: 16px;
      overflow-x: auto;
      width: 100%;
    }
    .history-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
    }
    .history-table th,
    .history-table td {
      padding: 16px 14px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      vertical-align: top;
    }
    .history-table thead th {
      text-align: left;
      color: #475569;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(248, 250, 252, 0.9);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .history-table tbody tr:hover {
      background: rgba(240, 255, 252, 0.85);
    }
    .history-table tbody tr:last-child td { border-bottom: none; }
    .history-table td strong {
      color: #0f172a;
      display: block;
      margin-bottom: 4px;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .secondary-text {
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.4;
    }
    .cell-dates .link-button {
      margin-top: 8px;
      border: none;
      background: transparent;
      color: #0f8b8d;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 700;
    }
    .cell-dates .link-button:hover { text-decoration: underline; }
    .cell-center { text-align: center; white-space: nowrap; }
    .cell-reason { max-width: 240px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 10px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .status-pill.pending { color: #92400e; background: rgba(245, 158, 11, 0.12); }
    .status-pill.approved { color: #0f766e; background: rgba(5, 150, 105, 0.12); }
    .status-pill.rejected { color: #b91c1c; background: rgba(251, 113, 133, 0.12); }
    .cell-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .small-button {
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 999px;
      background: #ffffff;
      color: #0f172a;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .small-button:hover { background: rgba(248, 250, 252, 0.95); }
    .small-button.delete {
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.2);
    }
    .small-button.progress {
      color: #0f8b8d;
      border-color: rgba(15, 139, 141, 0.22);
      background: rgba(15, 139, 141, 0.06);
    }
    .small-button:disabled { opacity: 0.65; cursor: not-allowed; }
    .muted-text { color: #94a3b8; font-size: 0.85rem; font-weight: 600; }
    @media (max-width: 1024px) {
      .history-table { min-width: 900px; }
    }
    @media (max-width: 760px) {
      .table-heading { flex-direction: column; }
      .history-table { min-width: 700px; }
    }
    @media (max-width: 560px) {
      .history-table { min-width: 600px; }
      .history-table th, .history-table td { padding: 12px 10px; }
    }
    .dates-popup-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(3px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .dates-popup-card {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.4);
      width: 100%;
      max-width: 420px;
      overflow: hidden;
    }
    .dates-popup-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 22px 16px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.8);
      background: linear-gradient(135deg, #f0fdfa, #fff7ed);
    }
    .dates-popup-eyebrow {
      margin: 0 0 4px;
      color: #0f8b8d;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .dates-popup-header h3 { margin: 0; color: #0f172a; font-size: 1.1rem; font-weight: 800; }
    .dates-popup-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #64748b;
      font-size: 1rem;
      padding: 4px 6px;
      border-radius: 6px;
      line-height: 1;
      flex-shrink: 0;
    }
    .dates-popup-close:hover { background: rgba(226, 232, 240, 0.6); }
    .dates-popup-list {
      padding: 12px 22px;
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dates-popup-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(248, 250, 252, 0.8);
      border: 1px solid rgba(226, 232, 240, 0.7);
    }
    .dates-popup-icon { font-size: 1rem; flex-shrink: 0; }
    .dates-popup-date {
      color: #0f172a;
      font-size: 0.9rem;
      font-weight: 700;
      flex: 1;
    }
    .dates-popup-session {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .session-full { color: #0f766e; background: rgba(15, 118, 110, 0.1); }
    .session-morning { color: #0369a1; background: rgba(3, 105, 161, 0.1); }
    .session-afternoon { color: #7c3aed; background: rgba(124, 58, 237, 0.1); }
    .dates-popup-footer {
      padding: 12px 22px;
      border-top: 1px solid rgba(226, 232, 240, 0.8);
      background: rgba(248, 250, 252, 0.6);
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 600;
      text-align: center;
    }
`]
})
export class DashboardHistoryTableComponent implements OnInit, OnChanges, OnDestroy {
  readonly translate = inject(TranslateService);

  @Input({ required: true }) leaves: AdminLeaveTableRow[] = [];
  @Input() leaveTypes: LeaveType[] = [];
  @Input() title = 'All leave requests';
  @Input() description = 'Your complete leave request history.';
  @Input() showRequestActions = false;
  @Input() deletingLeaveId: number | null = null;
  @Input() isLoading = false;

  @Output() editRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() deleteRequested = new EventEmitter<AdminLeaveTableRow>();

  popupLeave: AdminLeaveTableRow | null = null;
  private _progressLeave: AdminLeaveTableRow | null = null;

  get progressLeave(): AdminLeaveTableRow | null {
    return this._progressLeave;
  }

  set progressLeave(value: AdminLeaveTableRow | null) {
    this._progressLeave = value;
  }

  constructor() {}

  ngOnInit(): void {
    this.restoreProgressLeave();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leaves'] && this.leaves.length > 0 && !this._progressLeave) {
      this.restoreProgressLeave();
    }
  }

  ngOnDestroy(): void {
  }

  openDatesPopup(leave: AdminLeaveTableRow): void {
    this.popupLeave = leave;
  }

  showProgress(leave: AdminLeaveTableRow): void {
    this.progressLeave = leave;
  }

  handleEdit(leave: AdminLeaveTableRow): void {
    this.editRequested.emit(leave);
  }

  handleDelete(leave: AdminLeaveTableRow): void {
    this.deleteRequested.emit(leave);
  }

  formatDuration(value: number): string {
    if (value == null) {
      return '—';
    }
    return Number.isInteger(value) ? `${value} day${value !== 1 ? 's' : ''}` : `${value.toFixed(1).replace(/\.0$/, '')} days`;
  }

  formatStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    const normalized = status === 'MANAGER_APPROVED' ? 'Pending admin' : titleCase(status.toLowerCase());
    return normalized;
  }

  statusClass(status: string): string {
    if (!status) return 'pending';
    const key = status.toLowerCase();
    if (key.includes('approved')) return 'approved';
    if (key.includes('rejected')) return 'rejected';
    return 'pending';
  }

  formatDecision(approvedBy: string | null, rejectedBy: string | null, dir: Record<string, string> = {}): string {
    if (rejectedBy) {
      return `Rejected by ${dir[rejectedBy.toLowerCase()] || rejectedBy}`;
    }
    if (approvedBy) {
      return `Approved by ${dir[approvedBy.toLowerCase()] || approvedBy}`;
    }
    return 'Pending';
  }

  formatAdminDecision(approvedBy: string | null, rejectedBy: string | null, status: string, managerRejectedBy: string | null, dir: Record<string, string> = {}): string {
    if (rejectedBy) {
      return `Rejected by ${dir[rejectedBy.toLowerCase()] || rejectedBy}`;
    }
    if (approvedBy) {
      return `Approved by ${dir[approvedBy.toLowerCase()] || approvedBy}`;
    }
    if (status === 'REJECTED' && managerRejectedBy) {
      return 'Not reached';
    }
    return 'Pending';
  }

  translateLeaveType(value: string): string {
    const key = `leaveTypes.${value}`;
    const translated = this.translate.getTranslation(key);
    return translated !== key ? translated : value || 'Unassigned';
  }

  fmtDate(value: string | number[] | unknown): string {
    return formatDate(value);
  }

  private restoreProgressLeave(): void {
    // Keep existing state for progress modal if needed. No persisted restore yet.
  }
}
