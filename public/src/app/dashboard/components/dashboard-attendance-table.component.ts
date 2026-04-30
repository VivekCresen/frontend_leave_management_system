import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, effect, inject, Input, OnChanges, PLATFORM_ID, SimpleChanges } from '@angular/core';
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
import { AttendanceLogDto } from '../../services/auth.service';
import { TranslateService } from '../../i18n/translate.service';

ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

const attendanceTheme = themeQuartz.withParams({
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 13,
  headerBackgroundColor: '#f8fafc',
  headerTextColor: '#475569',
  headerFontSize: 11,
  headerFontWeight: 800,
  borderColor: 'rgba(226, 232, 240, 0.9)',
  rowBorder: { color: 'rgba(226, 232, 240, 0.7)', width: 1 },
  oddRowBackgroundColor: 'rgba(248, 250, 252, 0.5)',
  rowHoverColor: 'rgba(15, 139, 141, 0.04)',
  selectedRowBackgroundColor: 'rgba(15, 139, 141, 0.08)',
  accentColor: '#0f8b8d',
  foregroundColor: '#0f172a',
  rowHeight: 64,
  headerHeight: 40,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-attendance-table',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="table-card">

      <div class="table-heading">
        <div>
          <p class="eyebrow">Attendance</p>
          <h3>{{ title }}</h3>
          <p>{{ description }}</p>
        </div>
        <span class="count-pill">{{ logs.length }} records</span>
      </div>

      <div *ngIf="logs.length === 0" class="empty-state">
        <h4>No attendance records</h4>
        <p>{{ emptyMessage }}</p>
      </div>

      <div *ngIf="logs.length > 0 && agGridMounted" class="ag-shell">
        <ag-grid-angular
          class="att-ag-grid"
          [theme]="agTheme"
          [columnDefs]="columnDefs"
          [defaultColDef]="defaultColDef"
          [rowData]="logs"
          [pagination]="true"
          [paginationPageSize]="agPageSize"
          [paginationPageSizeSelector]="[10, 25, 50]"
          [domLayout]="'autoHeight'"
          (gridReady)="onGridReady($event)">
        </ag-grid-angular>
      </div>

    </div>
  `,
  styles: [`
    .table-card {
      border: 1px solid rgba(148,163,184,0.22);
      border-radius: 20px;
      background: #ffffff;
      padding: 16px 20px 14px;
      box-shadow: 0 1px 4px rgba(15,23,42,0.06), 0 12px 40px -20px rgba(15,23,42,0.14);
      display: flex;
      flex-direction: column;
    }
    .table-heading {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; padding-bottom: 12px;
      border-bottom: 1px solid rgba(226,232,240,0.85);
      margin-bottom: 10px;
    }
    .eyebrow { margin: 0; color: #0f8b8d; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    .table-heading h3 { margin: 2px 0 0; color: #0f172a; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em; }
    .table-heading p { margin: 4px 0 0; color: #64748b; font-size: 0.85rem; line-height: 1.45; }
    .count-pill {
      min-height: 36px; display: inline-flex; align-items: center;
      padding: 0 14px; border-radius: 999px; white-space: nowrap;
      border: 1px solid rgba(15,139,141,0.2); background: rgba(15,139,141,0.08);
      color: #0f766e; font-size: 0.8rem; font-weight: 800;
    }
    .empty-state {
      margin-top: 10px; padding: 32px; border-radius: 16px; text-align: center;
      border: 1.5px dashed rgba(148,163,184,0.45);
      background: rgba(248,250,252,0.6);
    }
    .empty-state h4 { margin: 0 0 6px; color: #0f172a; font-size: 1rem; font-weight: 700; }
    .empty-state p { margin: 0; color: #64748b; font-size: 0.9rem; }
    .ag-shell {
      margin-top: 10px;
      border: 1px solid rgba(226,232,240,0.8);
      border-radius: 12px;
      overflow: hidden;
    }

    :host ::ng-deep .att-ag-grid .ag-employee-cell {
      display: flex; flex-direction: column; justify-content: center; gap: 2px;
      padding: 8px 0; line-height: 1.4;
    }
    :host ::ng-deep .att-ag-grid .ag-employee-cell strong { color: #0f172a; font-size: 0.92rem; font-weight: 700; }
    :host ::ng-deep .att-ag-grid .ag-employee-cell small { color: #0f8b8d; font-size: 0.8rem; font-weight: 600; }

    :host ::ng-deep .att-ag-grid .ag-role-pill {
    
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      
    }

    :host ::ng-deep .att-ag-grid .ag-time-cell { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    :host ::ng-deep .att-ag-grid .ag-time-cell .ic-in { color: #0f8b8d; }
    :host ::ng-deep .att-ag-grid .ag-time-cell .ic-out { color: #f97316; }

    :host ::ng-deep .att-ag-grid .ag-badge-active {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.75rem; font-weight: 700; color: #b45309;
    }

    :host ::ng-deep .att-ag-grid .ag-status-pill {
      font-weight: 700;
    }
    :host ::ng-deep .att-ag-grid .ag-status-pill.complete {  color: #047857;}
    :host ::ng-deep .att-ag-grid .ag-status-pill.active { color: #b45309;}

    :host ::ng-deep .att-ag-grid .ag-paging-panel {
      border-top: 1px solid rgba(226,232,240,0.85);
      background: rgba(248,250,252,0.7);
      color: #475569; font-size: 0.84rem; font-weight: 500;
      padding: 0 16px; min-height: 44px;
    }

    [data-theme="dark"] .table-card { background: var(--surface-bg); border-color: var(--surface-border); box-shadow: var(--surface-shadow); }
    [data-theme="dark"] .table-heading { border-bottom-color: var(--surface-border); }
    [data-theme="dark"] .table-heading h3 { color: var(--surface-heading); }
    [data-theme="dark"] .table-heading p { color: var(--surface-body); }
    [data-theme="dark"] .eyebrow { color: var(--app-teal); }
    [data-theme="dark"] .count-pill { background: rgba(45,212,191,0.1); border-color: rgba(45,212,191,0.2); color: #2dd4bf; }
    [data-theme="dark"] .empty-state { background: rgba(15,23,42,0.4); border-color: var(--surface-border); }
    [data-theme="dark"] .empty-state h4 { color: var(--surface-heading); }
    [data-theme="dark"] .empty-state p { color: var(--surface-body); }
    [data-theme="dark"] .ag-shell { border-color: var(--surface-border); }

    [data-theme="dark"] :host ::ng-deep .att-ag-grid .ag-employee-cell strong { color: var(--surface-heading); }
    [data-theme="dark"] :host ::ng-deep .att-ag-grid .ag-employee-cell small { color: var(--app-teal); }
    [data-theme="dark"] :host ::ng-deep .att-ag-grid .ag-role-pill { background: rgba(51,65,85,0.4); color: var(--surface-body); border-color: rgba(71,85,105,0.4); }
    [data-theme="dark"] :host ::ng-deep .att-ag-grid .ag-time-cell { color: var(--surface-heading); }
  `]
})
export class DashboardAttendanceTableComponent implements AfterViewInit, OnChanges {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private gridApi: GridApi<AttendanceLogDto> | null = null;

  @Input() logs: AttendanceLogDto[] = [];
  @Input() title = 'Attendance Logs';
  @Input() description = 'Day-wise check-in and check-out records.';
  @Input() emptyMessage = 'No attendance logs recorded yet.';

  agGridMounted = false;
  readonly agTheme = attendanceTheme;
  readonly agPageSize = 10;

  readonly defaultColDef: ColDef<AttendanceLogDto> = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressMovable: true
  };

  constructor() {
    effect(() => {
      this.translate.currentLang(); // track signal
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.columnDefs);
      }
    });
  }

  private tr(key: string, fallback: string): string {
    const v = this.translate.getTranslation(key);
    return v !== key ? v : fallback;
  }

  get columnDefs(): ColDef<AttendanceLogDto>[] {
    return [
      {
        headerName: this.tr('attendanceTable.employee', 'Employee'),
        field: 'fullName',
        minWidth: 180, flex: 2,
        cellRenderer: ({ data }: ICellRendererParams<AttendanceLogDto>) =>
          data ? `<div class="ag-employee-cell">
                    <strong>${this.esc(data.fullName || data.username)}</strong>
                    <small>${this.esc(data.username)}</small>
                  </div>` : ''
      },
      {
        headerName: this.tr('attendanceTable.role', 'Role'),
        field: 'role',
        minWidth: 110, flex: 0.8,
        cellRenderer: ({ value }: ICellRendererParams<AttendanceLogDto>) => {
          if (!value) return '';
          const roleKey = 'roles.' + String(value).toLowerCase();
          const translated = this.translate.getTranslation(roleKey);
          const label = translated !== roleKey ? translated : String(value);
          return `<span class="ag-role-pill">${this.esc(label)}</span>`;
        }
      },
      {
        headerName: this.tr('attendanceTable.date', 'Date'),
        field: 'dateOfLog',
        minWidth: 130, flex: 1,
        valueFormatter: ({ value }: ValueFormatterParams<AttendanceLogDto>) => this.fmtDate(value)
      },
      {
        headerName: this.tr('attendanceTable.checkIn', 'Check-in'),
        field: 'checkInTime',
        minWidth: 110, flex: 0.9,
        cellRenderer: ({ value }: ICellRendererParams<AttendanceLogDto>) =>
          `<div class="ag-time-cell"><i class="fas fa-sign-in-alt ic-in"></i>${this.fmtTime(value)}</div>`
      },
      {
        headerName: this.tr('attendanceTable.checkOut', 'Check-out'),
        field: 'checkOutTime',
        minWidth: 110, flex: 0.9,
        cellRenderer: ({ data }: ICellRendererParams<AttendanceLogDto>) => {
          if (!data) return '';
          if (data.checkOutTime)
            return `<div class="ag-time-cell"><i class="fas fa-sign-out-alt ic-out"></i>${this.fmtTime(data.checkOutTime)}</div>`;
          const activeLabel = this.tr('attendanceTable.active', 'Active');
          return `<span class="ag-badge-active"><i class="fas fa-circle" style="font-size:0.4rem;color:#f59e0b"></i> ${activeLabel}</span>`;
        }
      },
      {
        headerName: this.tr('attendanceTable.duration', 'Duration'),
        minWidth: 100, flex: 0.8,
        valueGetter: ({ data }) => data ? this.getDuration(data) : '—'
      },
      {
        headerName: this.tr('attendanceTable.status', 'Status'),
        minWidth: 120, flex: 0.9,
        cellRenderer: ({ data }: ICellRendererParams<AttendanceLogDto>) => {
          if (!data) return '';
          const completeLabel = this.tr('attendanceTable.complete', 'Complete');
          const inProgressLabel = this.tr('attendanceTable.inProgress', 'In progress');
          return data.checkOutTime
            ? `<span class="ag-status-pill complete">${completeLabel}</span>`
            : `<span class="ag-status-pill active">${inProgressLabel}</span>`;
        }
      }
    ];
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    queueMicrotask(() => {
      this.agGridMounted = true;
      this.cdr.detectChanges();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logs'] && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.logs);
    }
  }

  onGridReady(event: GridReadyEvent<AttendanceLogDto>): void {
    this.gridApi = event.api;
  }

  private getDuration(log: AttendanceLogDto): string {
    if (!log.checkOutTime) return '—';
    const ms = new Date(log.checkOutTime).getTime() - new Date(log.checkInTime).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  private fmtTime(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private fmtDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private esc(v: string | null | undefined): string {
    return (v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
