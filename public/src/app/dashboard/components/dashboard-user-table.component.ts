import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ManagedUser } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-user-table',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe],
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

  @Output() editRequested = new EventEmitter<ManagedUser>();
  @Output() deleteRequested = new EventEmitter<ManagedUser>();
  @Output() expandedToggled = new EventEmitter<void>();

  trackByUserId(_: number, user: ManagedUser): number {
    return user.id;
  }
}
