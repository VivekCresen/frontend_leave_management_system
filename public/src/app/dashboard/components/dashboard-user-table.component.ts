import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, effect, EventEmitter, inject, Input, OnChanges, OnInit, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClickedEvent,
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
import { ManagedUser } from '../../services/auth.service';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

ModuleRegistry.registerModules([ClientSideRowModelModule, PaginationModule]);

const userTableTheme = themeQuartz.withParams({
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
  rowHeight: 72,
  headerHeight: 40,
  wrapperBorderRadius: '0px',
  wrapperBorder: false,
  cellHorizontalPaddingScale: 1.1
});

@Component({
  selector: 'app-dashboard-user-table',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule, AgGridAngular, TranslatePipe],
  templateUrl: './dashboard-user-table.component.html',
  styleUrls: ['./dashboard-user-table.component.css']
})
export class DashboardUserTableComponent implements AfterViewInit, OnChanges, OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private gridApi: GridApi<ManagedUser> | null = null;

  @Input({ required: true }) users: ManagedUser[] = [];
  @Input() title = 'Managed users';
  @Input() description = 'Review the accounts visible from this workspace.';
  @Input() emptyTitle = 'No users found';
  @Input() emptyMessage = 'Users created here will appear in this table.';
  @Input() showActions = true;
  @Input() readMoreLabel = '';
  @Input() readMoreLink = '';
  @Input() canToggleExpanded = false;
  @Input() isExpanded = false;
  @Input() collapseLabel = 'Show less';
  @Input() showTableTools = false;
  @Input() enableBodyScroll = false;
  @Input() bodyMaxHeight = '';
  @Input() compactCard = false;
  @Input() expandToFill = false;
  @Input() useAgGrid = false;
  @Input() initialRole = '';
  @Input() initialStatus = '';
  @Input() deletingUserId: number | null = null;

  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() expandedToggled = new EventEmitter<void>();

  searchTerm = '';
  selectedRole = 'ALL';
  selectedStatus = 'ALL';
  sortKey = 'fullName';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage = 1;
  pageSize = 4;
  agGridMounted = false;

  constructor() {
    effect(() => {
      this.translate.currentLang(); // track signal
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.agColumnDefsWithActions);
        this.gridApi.setGridOption('rowData', this.filteredUsers);
      }
    });
  }

  readonly agTheme = userTableTheme;
  readonly agPageSize = 7;
  readonly defaultColDef: ColDef<ManagedUser> = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressMovable: true
  };

  get agColumnDefs(): ColDef<ManagedUser>[] {
    const tr = (k: string, fb: string) => { const v = this.translate.getTranslation(k); return v !== k ? v : fb; };
    return [
      {
        headerName: tr('userTable.user', 'User'),
        field: 'fullName',
        minWidth: 200,
        flex: 2,
        cellRenderer: ({ data }: ICellRendererParams<ManagedUser>) =>
          data
            ? `<div class="ag-user-cell">
                 <strong>${this.esc(data.fullName)}</strong>
                 <span>${this.esc(data.username)}</span>
                 <small>${this.esc(data.email)}</small>
               </div>`
            : ''
      },
      {
        headerName: tr('table.role', 'Role'),
        field: 'role',
        minWidth: 110,
        flex: 0.8,
        valueFormatter: ({ value }: ValueFormatterParams<ManagedUser>) => {
          if (!value) return '';
          const roleKey = 'roles.' + value.toLowerCase();
          const translated = this.translate.getTranslation(roleKey);
          return translated !== roleKey ? translated : this.titleCase(value);
        }
      },
      {
        headerName: tr('table.status', 'Status'),
        field: 'active',
        minWidth: 110,
        flex: 0.8,
        cellRenderer: ({ value }: ICellRendererParams<ManagedUser>) => {
          const activeLabel = tr('stats.active', 'Active');
          const inactiveLabel = tr('stats.inactive', 'Inactive');
          return `<span class="ag-status-badge ${value ? 'active' : 'inactive'}">${value ? activeLabel : inactiveLabel}</span>`;
        }
      },
      {
        headerName: tr('userTable.managerOwner', 'Manager / Owner'),
        field: 'createdBy',
        minWidth: 150,
        flex: 1,
        valueFormatter: ({ value }: ValueFormatterParams<ManagedUser>) => value || tr('userTable.system', 'System')
      },
      {
        headerName: tr('userTable.lastLogin', 'Last login'),
        field: 'lastLogin',
        minWidth: 170,
        flex: 1.1,
        valueFormatter: ({ value }: ValueFormatterParams<ManagedUser>) => this.fmtDate(value)
      }
    ];
  }

  get agColumnDefsWithActions(): ColDef<ManagedUser>[] {
    if (!this.showActions) return this.agColumnDefs;
    return [
      ...this.agColumnDefs,
      {
        headerName: this.translate.getTranslation('table.actions') !== 'table.actions' ? this.translate.getTranslation('table.actions') : 'Actions',
        sortable: false,
        resizable: false,
        minWidth: 140,
        flex: 0.9,
        cellRenderer: ({ data }: ICellRendererParams<ManagedUser>) => {
          if (!data) return '';
          const deleting = this.deletingUserId === data.id;
          const t = (k: string, fb: string) => { const v = this.translate.getTranslation(k); return v !== k ? v : fb; };
          const editLabel = t('tableActions.edit', 'Edit');
          const deleteLabel = t('tableActions.delete', 'Delete');
          const deletingLabel = t('tableActions.deleting', 'Deleting...');
          const viewOnlyLabel = t('tableActions.viewOnly', 'View only');
          const edit = data.canEdit
            ? `<button class="ag-action-btn edit" data-id="${data.id}" ${deleting ? 'disabled' : ''}>${editLabel}</button>`
            : '';
          const del = data.canDelete
            ? `<button class="ag-action-btn delete${deleting ? ' is-loading' : ''}" data-id="${data.id}" ${deleting ? 'disabled' : ''}>${deleting ? deletingLabel : deleteLabel}</button>`
            : '';
          return edit || del
            ? `<div class="ag-action-cell">${edit}${del}</div>`
            : `<span class="ag-read-only">${viewOnlyLabel}</span>`;
        }
      }
    ];
  }

  get roleOptions(): string[] {
    return Array.from(new Set(this.users.map((u) => u.role).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  get filteredUsers(): ManagedUser[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.users.filter((u) => {
      const matchSearch =
        !term ||
        [u.fullName, u.username, u.email, u.companyId, u.createdBy]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(term));
      const matchRole = this.selectedRole === 'ALL' || u.role === this.selectedRole;
      const matchStatus =
        this.selectedStatus === 'ALL' ||
        (this.selectedStatus === 'ACTIVE' && u.active) ||
        (this.selectedStatus === 'INACTIVE' && !u.active);
      return matchSearch && matchRole && matchStatus;
    });
  }

  get sortedUsers(): ManagedUser[] {
    return [...this.filteredUsers].sort((a, b) => {
      const f = this.sortKey as keyof ManagedUser;
      const av = (a[f] ?? '').toString().toLowerCase();
      const bv = (b[f] ?? '').toString().toLowerCase();
      if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get displayedUsers(): ManagedUser[] {
    if (this.useAgGrid) return this.filteredUsers;
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedUsers.slice(start, start + this.pageSize);
  }

  get filteredCount(): number {
    return this.filteredUsers.length;
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() || this.selectedRole !== 'ALL' || this.selectedStatus !== 'ALL';
  }

  get visibleCountLabel(): string {
    return this.showTableTools ? `${this.filteredCount} records found` : `${this.users.length} records`;
  }

  get resolvedEmptyTitle(): string {
    return this.hasActiveFilters ? 'No matching users' : this.emptyTitle;
  }

  get resolvedEmptyMessage(): string {
    return this.hasActiveFilters ? 'Try a different search term or reset the filters.' : this.emptyMessage;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredCount / this.pageSize);
  }

  ngOnInit(): void {
    if (this.initialRole) this.selectedRole = this.initialRole;
    if (this.initialStatus) this.selectedStatus = this.initialStatus;
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.useAgGrid) return;
    queueMicrotask(() => {
      this.agGridMounted = true;
      this.cdr.detectChanges();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['users'] || changes['deletingUserId']) && this.gridApi) {
      this.gridApi.setGridOption('rowData', this.filteredUsers);
      this.gridApi.setGridOption('columnDefs', this.agColumnDefsWithActions);
    }
  }

  onGridReady(event: GridReadyEvent<ManagedUser>): void {
    this.gridApi = event.api;
  }

  onGridCellClicked(event: CellClickedEvent<ManagedUser>): void {
    const target = event.event?.target as HTMLElement | undefined;
    const btn = target?.closest('[data-id]') as HTMLElement | null;
    if (!btn) return;
    const id = Number(btn.dataset['id']);
    const user = this.users.find((u) => u.id === id);
    if (!user) return;
    if (this.deletingUserId === user.id) return;
    if (btn.classList.contains('edit')) this.editRequested.emit(user);
    if (btn.classList.contains('delete')) this.deleteRequested.emit(user);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'ALL';
    this.selectedStatus = 'ALL';
    this.currentPage = 1;
  }

  toggleSort(key: string): void {
    this.sortDirection = this.sortKey === key && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortKey = key;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  trackByUserId(_: number, user: ManagedUser): number {
    return user.id;
  }

  private titleCase(value: unknown): string {
    return typeof value === 'string' && value
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : '';
  }

  private fmtDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return 'Never';
    const d = new Date(value);
    return isNaN(d.getTime())
      ? 'Never'
      : new Intl.DateTimeFormat('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: 'numeric', minute: '2-digit'
        }).format(d);
  }

  private esc(v: string | null | undefined): string {
    return (v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
