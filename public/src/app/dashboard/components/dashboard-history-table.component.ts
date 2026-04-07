import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
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
import { LeaveType } from '../../services/leave.service';

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
  rowHeight: 68,
  headerHeight: 46,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-history-table',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
<!-- Balance Cards Row — full width, outside table card -->
<div *ngIf="leaveBalances.length > 0" class="balance-row">
  <div *ngFor="let b of leaveBalances" class="balance-card" [class.balance-exhausted]="b.remaining === 0" [class.balance-warn]="b.pct >= 75 && b.pct < 100">
    <div class="balance-top">
      <div class="balance-icon-wrap">
        <i class="fas fa-calendar-days"></i>
      </div>
      <div class="balance-info">
        <span class="balance-name">{{ b.name }}</span>
        <span class="balance-remaining" [class.balance-zero]="b.remaining === 0" [class.balance-warn-text]="b.pct >= 75 && b.pct < 100">
          {{ b.remaining % 1 === 0 ? b.remaining : b.remaining.toFixed(1) }} day{{ b.remaining !== 1 ? 's' : '' }} left
        </span>
      </div>
    </div>
    <div class="balance-bar-track">
      <div class="balance-bar-fill"
        [style.width.%]="b.pct"
        [class.bar-warn]="b.pct >= 75 && b.pct < 100"
        [class.bar-full]="b.pct === 100">
      </div>
    </div>
    <div class="balance-bottom">
      <span>{{ b.usedDays % 1 === 0 ? b.usedDays : b.usedDays.toFixed(1) }} used</span>
      <span>{{ b.maxDays }} total</span>
    </div>
  </div>
</div>

<!-- Table Card -->
<section class="table-card">
  <div class="table-heading">
    <div>
      <p class="eyebrow">Leave History</p>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <span class="count-pill">{{ leaves.length }} record{{ leaves.length !== 1 ? 's' : '' }}</span>
  </div>

  <div *ngIf="leaves.length === 0" class="empty-state">
    <h4>No leave history yet</h4>
    <p>Submit your first leave request to start building your history.</p>
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
    :host ::ng-deep .history-ag-grid .ag-action-muted {
      color: #94a3b8;
      font-size: 0.8rem;
      font-weight: 600;
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
  `]
})
export class DashboardHistoryTableComponent implements AfterViewInit, OnChanges {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private gridApi: GridApi<AdminLeaveTableRow> | null = null;

  @Input({ required: true }) leaves: AdminLeaveTableRow[] = [];
  @Input() leaveTypes: LeaveType[] = [];
  @Input() title = 'All leave requests';
  @Input() description = 'Your complete leave request history.';
  @Input() showRequestActions = false;

  @Output() editRequested = new EventEmitter<AdminLeaveTableRow>();
  @Output() deleteRequested = new EventEmitter<AdminLeaveTableRow>();

  gridMounted = false;
  readonly agTheme = historyTheme;

  get leaveBalances(): { name: string; maxDays: number; usedDays: number; remaining: number; pct: number }[] {
    return this.leaveTypes.map((lt) => {
      const usedDays = this.leaves
        .filter((l) => l.status === 'APPROVED' && l.leaveType.trim().toLowerCase() === lt.leaveName.trim().toLowerCase())
        .reduce((sum, l) => sum + (l.durationDays ?? 0), 0);
      const remaining = Math.max(0, lt.maxDays - usedDays);
      const pct = lt.maxDays > 0 ? Math.min(100, Math.round((usedDays / lt.maxDays) * 100)) : 0;
      return { name: lt.leaveName, maxDays: lt.maxDays, usedDays: Math.round(usedDays * 2) / 2, remaining: Math.round(remaining * 2) / 2, pct };
    });
  }

  readonly defaultColDef: ColDef<AdminLeaveTableRow> = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressMovable: true
  };

  get columnDefs(): ColDef<AdminLeaveTableRow>[] {
    return [
      {
        headerName: 'Leave Name',
        field: 'leaveType',
        minWidth: 150,
        flex: 1.5,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) =>
          `<div class="ag-leave-name-cell"><strong>${this.esc(value) || 'Unassigned'}</strong></div>`
      },
      {
        headerName: 'Date Range',
        field: 'fromDate',
        minWidth: 200,
        flex: 1.8,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) =>
          data
            ? `<div class="ag-date-cell">
                 <strong>${this.fmtDate(data.fromDate)}</strong>
                 <span>${data.halfDay ? (data.halfDaySession === 'MORNING' ? '🌅 Morning session' : '🌇 Afternoon session') : 'to ' + this.fmtDate(data.toDate)}</span>
               </div>`
            : ''
      },
      {
        headerName: 'Days',
        field: 'durationDays',
        minWidth: 90,
        flex: 0.7,
        cellRenderer: ({ data }: ICellRendererParams<AdminLeaveTableRow>) => {
          if (!data) return '';
          if (data.halfDay) {
            return `<span class="ag-duration-pill">0.5 day</span>`;
          }
          const v = data.durationDays ?? 1;
          return `<span class="ag-duration-pill">${v} day${v !== 1 ? 's' : ''}</span>`;
        }
      },
      {
        headerName: 'Reason',
        field: 'reason',
        minWidth: 220,
        flex: 2,
        valueFormatter: ({ value }: ValueFormatterParams) => value?.trim() || '—'
      },
      {
        headerName: 'Status',
        field: 'status',
        minWidth: 130,
        flex: 1,
        cellRenderer: ({ value }: ICellRendererParams<AdminLeaveTableRow>) => {
          const cls = (value ?? '').toLowerCase();
          const icons: Record<string, string> = {
            pending: 'fa-clock',
            approved: 'fa-circle-check',
            rejected: 'fa-circle-xmark'
          };
          const icon = icons[cls] ?? 'fa-circle';
          return `<span class="ag-status-badge ag-status-${cls}">
                    <i class="fas ${icon}"></i>
                    ${this.titleCase(value)}
                  </span>`;
        }
      },
      {
        headerName: 'Actions',
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
            return `<span class="ag-action-muted">No actions</span>`;
          }

          return `<div class="ag-actions-cell">
            <button type="button" class="ag-action-button" data-action="edit">Edit</button>
            <button type="button" class="ag-action-button delete" data-action="delete">Delete</button>
          </div>`;
        },
        onCellClicked: ({ data, event }) => {
          if (!data) {
            return;
          }

          const target = event?.target as HTMLElement | null;
          const action = target?.closest('[data-action]')?.getAttribute('data-action');

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
    if (changes['showRequestActions'] && this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }

    if (changes['leaves'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.leaves);
    }
  }

  onGridReady(event: GridReadyEvent<AdminLeaveTableRow>): void {
    this.gridApi = event.api;
  }

  private fmtDate(value: string): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime())
      ? value
      : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
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
