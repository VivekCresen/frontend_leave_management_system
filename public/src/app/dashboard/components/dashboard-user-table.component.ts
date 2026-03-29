import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagedUser } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-user-table',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule],
  templateUrl: './dashboard-user-table.component.html',
  styleUrls: ['./dashboard-user-table.component.css']
})
export class DashboardUserTableComponent {
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

  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() expandedToggled = new EventEmitter<void>();

  searchTerm = '';
  selectedRole = 'ALL';
  selectedStatus = 'ALL';

  get roleOptions(): string[] {
    return Array.from(new Set(this.users.map((user) => user.role).filter((role) => !!role))).sort((left, right) =>
      left.localeCompare(right)
    );
  }

  get displayedUsers(): ManagedUser[] {
    const searchTerm = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        [user.fullName, user.username, user.email, user.companyId, user.createdBy]
          .filter((value): value is string => !!value)
          .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesRole = this.selectedRole === 'ALL' || user.role === this.selectedRole;
      const matchesStatus =
        this.selectedStatus === 'ALL' ||
        (this.selectedStatus === 'ACTIVE' && user.active) ||
        (this.selectedStatus === 'INACTIVE' && !user.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  get hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.selectedRole !== 'ALL' || this.selectedStatus !== 'ALL';
  }

  get visibleCountLabel(): string {
    return this.showTableTools ? `${this.displayedUsers.length} of ${this.users.length} records` : `${this.users.length} records`;
  }

  get resolvedEmptyTitle(): string {
    return this.hasActiveFilters ? 'No matching users' : this.emptyTitle;
  }

  get resolvedEmptyMessage(): string {
    return this.hasActiveFilters ? 'Try a different search term or reset the filters.' : this.emptyMessage;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = 'ALL';
    this.selectedStatus = 'ALL';
  }

  trackByUserId(_: number, user: ManagedUser): number {
    return user.id;
  }
}
