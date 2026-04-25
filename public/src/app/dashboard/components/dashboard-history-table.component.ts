import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  PLATFORM_ID,
  SimpleChanges
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ClientSideRowModelModule,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  ModuleRegistry,
  PaginationModule,
  themeQuartz,
  ValueFormatterParams
} from 'ag-grid-community';
import { AdminLeaveTableRow } from './dashboard-leave-table.component';
import { LeaveProgressModalComponent } from './leave-progress-modal.component';
import { LeaveType } from '../../services/leave.service';
import { TranslateService } from '../../i18n/translate.service';

ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

const historyTheme = themeQuartz.withParams({
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 15,
  headerBackgroundColor: 'rgba(248, 250, 252, 0.9)',
  headerTextColor: '#64748b',
  headerFontSize: 12,
  headerFontWeight: 800,
  borderColor: 'rgba(226, 232, 240, 0.8)',
  rowBorder: { color: 'rgba(226, 232, 240, 0.7)', width: 1 },
  oddRowBackgroundColor: 'rgba(248, 250, 252, 0.5)',
  rowHoverColor: 'rgba(15, 139, 141, 0.03)',
  selectedRowBackgroundColor: 'rgba(15, 139, 141, 0.08)',
  accentColor: '#0f8b8d',
  foregroundColor: '#0f172a',
  rowHeight: 100,
  headerHeight: 46,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-history-table',
  standalone: true,
  imports: [CommonModule, AgGridAngular, LeaveProgressModalComponent],
  template: `
<!-- Table Card -->
<section class="table-card">
  <div class="table-heading">
    <div>
      <p class="eyebrow">{{ translate.getTranslation('tableActions.leaveHistory') }}</p>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
      <span class="count-pill">{{ leaves.length }} record{{ leaves.length !== 1 ? 's' : '' }}</span>
    </div>
  </div>

  <div *ngIf="leaves.length === 0" class="empty-state">
    <h4>{{ translate.getTranslation('tableActions.noLeaveHistory') }}</h4>
    <p>{{ translate.getTranslation('tableActions.submitFirstLeave') }}</p>
  </div>

  <div *ngIf="leaves.length > 0 && gridMounted" class="ag-shell">
    <ag-grid-angular
      class="history-ag-grid"
      [theme]="agTheme"
      [rowData]="leaves"
      [columnDefs]="columnDefs"
      [defaultColDef]="defaultColDef"
      [pagination]="true"
      [paginationPageSize]="10"
      [paginationPageSizeSelector]="[10, 20, 50]"
      [suppressCellFocus]="true"
      [domLayout]="'autoHeight'"
      (gridReady)="onGridReady($event)">
    </ag-grid-angular>
  </div>
</section>

<!-- Progress modal -->
<app-leave-progress-modal
  *ngIf="progressLeave"
  [leave]="progressLeave"
  (closed)="progressLeave = null">
</app-leave-progress-modal>

<!-- Dates popup -->
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
        <strong class="dates-popup-date">{{ fmtDatePublic(d.date) }}</strong>
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
  styles: [`
    .table-card {
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
    .table-heading h3, .table-heading p { margin: 0; }
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
    .empty-state h4, .empty-state p { margin: 0; }
    .empty-state h4 { color: #0f172a; font-size: 1.05rem; font-weight: 700; }
    .empty-state p { margin-top: 8px; color: #64748b; line-height: 1.6; font-size: 0.9rem; }
    .ag-shell {
      margin-top: 10px;
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 12px;
      overflow: hidden;
    }
    .history-ag-grid { width: 100%; }

    :host ::ng-deep .history-ag-grid .ag-header-cell-label {
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-size: 0.78rem;
      font-weight: 800;
      color: #64748b;
    }
    :host ::ng-deep .history-ag-grid .ag-cell {
      display: flex;
      align-items: center;
      color: #0f172a;
      font-size: 0.95rem;
      white-space: normal;
      line-height: 1.5;
    }
    :host ::ng-deep .history-ag-grid .ag-leave-name-cell { display: flex; align-items: center; }
    :host ::ng-deep .history-ag-grid .ag-leave-name-cell strong {
      color: #0f172a; font-size: 1rem; font-weight: 700;
    }
    :host ::ng-deep .history-ag-grid .ag-date-cell {
      display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 6px 0; line-height: 1.4;
    }
    :host ::ng-deep .history-ag-grid .ag-date-cell strong {
      color: #0f172a; font-size: 0.95rem; font-weight: 700;
    }
    :host ::ng-deep .history-ag-grid .ag-date-cell span {
      color: #0f8b8d; font-size: 0.88rem; font-weight: 600;
    }
    :host ::ng-deep .history-ag-grid .ag-duration-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #c2410c;
      font-size: 0.92rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    :host ::ng-deep .history-ag-grid .ag-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.92rem;
      font-weight: 800;
      width: fit-content;
      white-space: nowrap;
    }
    :host ::ng-deep .history-ag-grid .ag-status-pending {
      background: transparent;
      color: #92400e;
    }
    :host ::ng-deep .history-ag-grid .ag-status-approved {
      background: transparent;
      color: #0f766e;
    }
    :host ::ng-deep .history-ag-grid .ag-status-rejected {
      background: transparent;
      color: #b42318;
    }
    :host ::ng-deep .history-ag-grid .ag-paging-panel {
      border-top: 1px solid rgba(226, 232, 240, 0.85);
      background: rgba(248, 250, 252, 0.7);
      color: #475569;
      font-size: 0.84rem;
      font-weight: 500;
      padding: 0 16px;
      min-height: 44px;
    }
    :host ::ng-deep .history-ag-grid .ag-actions-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    :host ::ng-deep .history-ag-grid .ag-action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      background: #ffffff;
      color: #0f172a;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }
    :host ::ng-deep .history-ag-grid .ag-action-button:hover {
      background: rgba(248, 250, 252, 0.95);
    }
    :host ::ng-deep .history-ag-grid .ag-action-button.delete {
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.22);
    }
    :host ::ng-deep .history-ag-grid .ag-action-button.progress {
      color: #0f8b8d;
      border-color: rgba(15, 139, 141, 0.22);
      background: rgba(15, 139, 141, 0.06);
    }
    :host ::ng-deep .history-ag-grid .ag-action-button:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }
    :host ::ng-deep .history-ag-grid .ag-action-muted {
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 600;
    }

    /* ── Individual date chips ───────────────────────────── */
    :host ::ng-deep .history-ag-grid .ag-dates-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 0;
      width: 100%;
    }
    :host ::ng-deep .history-ag-grid .ag-dates-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    :host ::ng-deep .history-ag-grid .ag-date-chip {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(248, 250, 252, 0.9);
      border: 1px solid rgba(226, 232, 240, 0.9);
      gap: 1px;
    }
    :host ::ng-deep .history-ag-grid .ag-date-chip-date {
      color: #0f172a;
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }
    :host ::ng-deep .history-ag-grid .ag-date-chip-session {
      font-size: 0.7rem;
      font-weight: 600;
      white-space: nowrap;
    }
    :host ::ng-deep .history-ag-grid .ag-dates-summary {
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 2px;
    }
    @media (max-width: 720px) {
      .table-card { padding: 18px; }
      .table-heading { flex-direction: column; }
    }

    /* ─── Leave Balance Row ──────────────────────────────── */
    .balance-row {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
      width: 100%;
    }
    .balance-card {
      flex: 1;
      min-width: 0;
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid rgba(226, 232, 240, 0.9);
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05), 0 8px 24px -12px rgba(15, 23, 42, 0.1);
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }
    .balance-card:hover {
      box-shadow: 0 4px 20px -6px rgba(15, 23, 42, 0.14);
      transform: translateY(-1px);
    }
    .balance-card.balance-exhausted {
      border-color: rgba(180, 35, 24, 0.2);
      background: rgba(254, 242, 242, 0.6);
    }
    .balance-card.balance-warn {
      border-color: rgba(245, 158, 11, 0.25);
      background: rgba(255, 251, 235, 0.6);
    }
    .balance-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .balance-icon-wrap {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(15, 139, 141, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0f8b8d;
      font-size: 0.88rem;
      flex-shrink: 0;
    }
    .balance-card.balance-exhausted .balance-icon-wrap {
      background: rgba(180, 35, 24, 0.1);
      color: #b42318;
    }
    .balance-card.balance-warn .balance-icon-wrap {
      background: rgba(245, 158, 11, 0.12);
      color: #d97706;
    }
    .balance-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .balance-name {
      color: #475569;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .balance-remaining {
      color: #0f766e;
      font-size: 1.1rem;
      font-weight: 800;
      line-height: 1.2;
      white-space: nowrap;
    }
    .balance-remaining.balance-zero { color: #b42318; }
    .balance-remaining.balance-warn-text { color: #d97706; }
    .balance-bar-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(226, 232, 240, 0.9);
      overflow: hidden;
    }
    .balance-bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0f8b8d, #155e75);
      transition: width 0.5s ease;
    }
    .balance-bar-fill.bar-warn { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .balance-bar-fill.bar-full { background: linear-gradient(90deg, #ef4444, #b91c1c); }
    .balance-bottom {
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 0.75rem;
      font-weight: 500;
    }
    @media (max-width: 900px) {
      .balance-row { flex-wrap: wrap; }
      .balance-card { flex: 1 1 calc(50% - 6px); }
    }
    @media (max-width: 560px) {
      .balance-card { flex: 1 1 100%; }
    }

    /* ── Dates popup ─────────────────────────────────────── */
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
    .dates-popup-header h3 {
      margin: 0;
      color: #0f172a;
      font-size: 1.1rem;
      font-weight: 800;
    }
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
    .session-full    { color: #0f766e; background: rgba(15, 118, 110, 0.1); }
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
export class DashboardHistoryTableComponent implements AfterViewInit, OnChanges {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly translate = inject(TranslateService);
  private gridApi: GridApi<AdminLeaveTableRow> | null = null;

  @Input({ required: true }) leaves: AdminLeaveTableRow[] = [];
  @Input() leaveTypes: LeaveType[] = [];
  @Input() title = 'All leave requests';
  @Input() description = 'Your complete leave request history.';
  @Input() showRequestActions = false;
  @Input() deletingLeaveId: number | null = null;

  @Output() editRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() deleteRequested = new EventEmitter<AdminLeaveTableRow>();

  gridMounted = false;
  readonly agTheme = historyTheme;
  popupLeave: AdminLeaveTableRow | null = null;
  progressLeave: AdminLeaveTableRow | null = null;

  constructor() {
    effect(() => {
      this.translate.currentLang(); // track signal
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.columnDefs);
        this.gridApi.setGridOption('rowData', this.leaves);
      }
    });
  }

  get leaveBalances(): { name: string; maxDays: number; usedDays: number; remaining: number; pct: number }[] {
    return this.leaveTypes
      .map((lt) => {
        const usedDays = this.leaves
          .filter((l) => {
            if (l.status !== 'APPROVED') return false;
            const t = l.leaveType?.trim().toLowerCase() ?? '';
            // match against both display name and unique name
            return t === lt.leaveName?.trim().toLowerCase()
                || t === lt.leaveUniqueName?.trim().toLowerCase();
          })
          .reduce((sum, l) => sum + (l.durationDays ?? 0), 0);

        const used      = Math.round(usedDays * 2) / 2;
        const remaining = Math.max(0, Math.round((lt.maxDays - used) * 2) / 2);
        const pct       = lt.maxDays > 0 ? Math.min(100, Math.round((used / lt.maxDays) * 100)) : 0;

        return { name: lt.leaveName, maxDays: lt.maxDays, usedDays: used, remaining, pct };
      })
      .filter((b) => b.maxDays > 0);
  }

  readonly defaultColDef: ColDef<AdminLeaveTableRow> = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressMovable: true
  };

  get columnDefs(): ColDef<AdminLeaveTableRow>[] {
    const tr = (k: string, fb: string) => { const v = this.translate.getTranslation(k); return v !== k ? v : fb; };
    return [
      {
        headerName: tr('table.leaveType', 'Leave Name'),
        field: 'leaveType',
        minWidth: 150,
        flex: 1.5,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const typeStr = value ? String(value) : '';
          const tKey = 'leaveTypes.' + typeStr;
          const translated = this.translate.getTranslation(tKey) !== tKey ? this.translate.getTranslation(tKey) : typeStr || 'Unassigned';
          return `<div class="ag-leave-name-cell"><strong>${this.esc(translated)}</strong></div>`;
        }
      },
      {
        headerName: tr('table.dateRange', 'Selected Dates'),
        field: 'fromDate',
        minWidth: 260,
        flex: 2.2,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          const dates = data.leaveDates ?? [];
          if (dates.length === 0) return '<span style="color:#94a3b8;">—</span>';

          const sessionLabel = (dt: string) =>
            dt === 'MORNING_HALF' ? 'Morning' : dt === 'AFTERNOON_HALF' ? 'Afternoon' : 'Full day';
          const sessionColor = (dt: string) =>
            dt === 'MORNING_HALF' ? '#0369a1' : dt === 'AFTERNOON_HALF' ? '#7c3aed' : '#0f766e';
          const sessionIcon = (dt: string) =>
            dt === 'MORNING_HALF' ? '🌅' : dt === 'AFTERNOON_HALF' ? '🌇' : '📅';

          const total = dates.reduce((s, d) => s + (d.dayType?.includes('HALF') ? 0.5 : 1.0), 0);
          const totalFmt = Number.isInteger(total) ? `${total}` : total.toFixed(1);
          const first = dates[0];
          const extra = dates.length - 1;

          const dateText = this.fmtDate(first.date);
          const color = sessionColor(first.dayType ?? '');
          const badge = `<span style="color:${color};font-size:0.7rem;font-weight:700;background:${color}18;padding:1px 5px;border-radius:4px;margin-left:4px;">${sessionLabel(first.dayType ?? '')}</span>`;
          const moreLink = extra > 0
            ? `<br><button data-action="show-dates" data-leave-id="${data.id}" style="background:none;border:none;padding:0;cursor:pointer;color:#0f8b8d;font-size:0.76rem;font-weight:700;text-decoration:underline;text-underline-offset:2px;line-height:1.8;">+${extra} more date${extra !== 1 ? 's' : ''}</button>`
            : '';
          const summary = `<br><span style="color:#94a3b8;font-size:0.7rem;">${dates.length} date${dates.length !== 1 ? 's' : ''} · ${totalFmt} day${total !== 1 ? 's' : ''}</span>`;

          return `<span style="font-size:0.82rem;font-weight:700;color:#0f172a;">${sessionIcon(first.dayType ?? '')} ${dateText}</span>${badge}${moreLink}${summary}`;
        },
        onCellClicked: ({ data, event }) => {
          const target = event?.target as HTMLElement | null;
          if (target?.closest('[data-action="show-dates"]') && data) {
            this.popupLeave = data;
          }
        }
      },
      {
        headerName: 'Days',
        field: 'durationDays',
        minWidth: 90,
        flex: 0.7,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          const v = data.durationDays ?? 1;
          const formatted = Number.isInteger(v) ? `${v}` : v.toFixed(1).replace(/\.0$/, '');
          return `<span class="ag-duration-pill">${formatted} day${v !== 1 ? 's' : ''}</span>`;
        }
      },
      {
        headerName: tr('table.reason', 'Reason'),
        field: 'reason',
        minWidth: 220,
        flex: 2,
        valueFormatter: ({ value }: ValueFormatterParams) => value?.trim() || '—'
      },
      {
        headerName: tr('table.status', 'Status'),
        field: 'status',
        minWidth: 130,
        flex: 1,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const raw = (value ?? '') as string;
          const cls = raw === 'MANAGER_APPROVED' ? 'manager-approved' : raw.toLowerCase();
          const icons: Record<string, string> = {
            pending: 'fa-clock',
            'manager-approved': 'fa-hourglass-half',
            approved: 'fa-circle-check',
            rejected: 'fa-circle-xmark'
          };
          const icon = icons[cls] ?? 'fa-circle';
          const tKey = 'table.' + (raw === 'MANAGER_APPROVED' ? 'pending_admin' : raw.toLowerCase());
          const label = this.translate.getTranslation(tKey) !== tKey ? this.translate.getTranslation(tKey) : (raw === 'MANAGER_APPROVED' ? 'Pending Admin' : this.titleCase(raw));
          return `<span class="ag-status-badge ag-status-${cls}">
                    <i class="fas ${icon}"></i>
                    ${label}
                  </span>`;
        }
      },
      {
        headerName: tr('table.manager', 'Manager'),
        minWidth: 180,
        flex: 1.3,
        sortable: false,
        valueGetter: ({ data }) => data?.managerApprovedBy ?? data?.managerRejectedBy ?? '',
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          const rej = tr('table.rejected', 'Rejected');
          const apr = tr('table.approved', 'Approved');
          const pend = tr('table.pending', 'Pending');
          if (data.managerRejectedBy) {
            return `<div class="ag-date-cell"><strong style="color:#b42318;">${rej}</strong><span>${this.esc(data.managerRejectedBy)}</span></div>`;
          }
          if (data.managerApprovedBy) {
            return `<div class="ag-date-cell"><strong style="color:#0f766e;">${apr}</strong><span>${this.esc(data.managerApprovedBy)}</span></div>`;
          }
          return `<span style="color:#94a3b8;">${pend}</span>`;
        }
      },
      {
        headerName: tr('table.admin', 'Admin'),
        minWidth: 180,
        flex: 1.3,
        sortable: false,
        valueGetter: ({ data }) => data?.adminApprovedBy ?? data?.adminRejectedBy ?? '',
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          const rej = tr('table.rejected', 'Rejected');
          const apr = tr('table.approved', 'Approved');
          const pend = tr('table.pending', 'Pending');
          const notReached = tr('table.notReached', 'Not reached');
          if (data.adminRejectedBy) {
            return `<div class="ag-date-cell"><strong style="color:#b42318;">${rej}</strong><span>${this.esc(data.adminRejectedBy)}</span></div>`;
          }
          if (data.adminApprovedBy) {
            return `<div class="ag-date-cell"><strong style="color:#0f766e;">${apr}</strong><span>${this.esc(data.adminApprovedBy)}</span></div>`;
          }
          if (data.status === 'REJECTED' && data.managerRejectedBy) {
            return `<span style="color:#94a3b8;">${notReached}</span>`;
          }
          return `<span style="color:#94a3b8;">${pend}</span>`;
        }
      },
      {
        headerName: tr('table.progress', 'Progress'),
        minWidth: 140,
        flex: 1,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) {
            return '';
          }

          return `<button type="button" class="ag-action-button progress" data-action="progress">
            <i class="fas fa-chart-line"></i>
            ${tr('tableActions.track', 'Track')}
          </button>`;
        },
        onCellClicked: ({ data, event }) => {
          if (!data) {
            return;
          }

          const target = event?.target as HTMLElement | null;
          const action = target?.closest('[data-action]')?.getAttribute('data-action');
          if (action === 'progress') {
            this.progressLeave = data;
          }
        }
      },
      {
        headerName: tr('table.actions', 'Actions'),
        minWidth: 180,
        flex: 1.2,
        hide: !this.showRequestActions,
        sortable: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) {
            return '';
          }

          if (!data.editable || data.status !== 'PENDING') {
            return `<span class="ag-action-muted">${tr('tableActions.noActions', 'No actions')}</span>`;
          }

          const deleting = this.deletingLeaveId === data.id;
          const editLbl = tr('tableActions.edit', 'Edit');
          const deleteLbl = tr('tableActions.delete', 'Delete');
          const deletingLbl = tr('tableActions.deleting', 'Deleting...');
          return `<div class="ag-actions-cell">
            <button type="button" class="ag-action-button" data-action="edit" ${deleting ? 'disabled' : ''}>${editLbl}</button>
            <button type="button" class="ag-action-button delete${deleting ? ' is-loading' : ''}" data-action="delete" ${deleting ? 'disabled' : ''}>${deleting ? deletingLbl : deleteLbl}</button>
          </div>`;
        },
        onCellClicked: ({ data, event }) => {
          if (!data) {
            return;
          }

          const target = event?.target as HTMLElement | null;
          const action = target?.closest('[data-action]')?.getAttribute('data-action');

          if (this.deletingLeaveId === data.id) {
            return;
          }

          if (action === 'edit') {
            this.editRequested.emit(data);
          }

          if (action === 'delete') {
            this.deleteRequested.emit(data);
          }
        }
      }
    ];
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    queueMicrotask(() => {
      this.gridMounted = true;
      this.cdr.detectChanges();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['showRequestActions'] || changes['deletingLeaveId']) && this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }

    if (changes['leaves'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.leaves);
    }
  }

  onGridReady(event: GridReadyEvent<AdminLeaveTableRow>): void {
    this.gridApi = event.api;
  }

  fmtDatePublic(value: string | number[] | unknown): string {
    return this.fmtDate(value);
  }

  private fmtDate(value: string | number[] | unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    let iso = '';
    if (Array.isArray(value) && value.length >= 3) {
      const [y, m, d] = value as number[];
      iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else {
      iso = String(value).trim();
    }
    if (!iso) return '—';
    // Parse as local date to avoid UTC offset shifting the day
    const parts = iso.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
    }
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  private titleCase(value: unknown): string {
    return typeof value === 'string' && value
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : '';
  }

  private esc(v: string | null | undefined): string {
    return (v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
