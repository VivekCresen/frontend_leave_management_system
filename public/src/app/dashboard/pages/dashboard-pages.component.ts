import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardPageComponent } from '../dashboard-page.component';
import {
  DashboardPageId,
  getDefaultDashboardPage,
  isDashboardPageAllowed
} from '../dashboard.config';
import { LoginResponse, injectAuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

abstract class DashboardPageBase {
  private readonly authService = injectAuthService();
  private readonly currentPageId: DashboardPageId;

  constructor(
    private readonly router: Router,
    private readonly toastService: ToastService,
    pageId: DashboardPageId
  ) {
    this.currentPageId = pageId;
    const user = this.authService.currentUser();

    if (!user) {
      this.router.navigate(['/login']);
      this.toastService.info('Please log in first');
      return;
    }

    if (!user.active) {
      this.authService.clearCurrentUser();
      this.router.navigate(['/login']);
      this.toastService.error('Your account is inactive. Please contact an administrator.');
      return;
    }

    if (!isDashboardPageAllowed(user.role, this.currentPageId)) {
      this.router.navigate(['/dashboard', getDefaultDashboardPage(user.role)]);
    }
  }

  get user(): LoginResponse {
    return (
      this.authService.currentUser() ?? {
        username: '',
        email: '',
        role: 'EMPLOYEE',
        active: false,
        token: '',
        message: ''
      }
    );
  }

  get pageId(): DashboardPageId {
    return this.currentPageId;
  }
}

@Component({
  selector: 'app-dashboard-overview-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardOverviewPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'overview');
  }
}

@Component({
  selector: 'app-dashboard-users-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardUsersPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'users');
  }
}

@Component({
  selector: 'app-dashboard-roles-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardRolesPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'roles');
  }
}

@Component({
  selector: 'app-dashboard-leaves-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardLeavesPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'leaves');
  }
}

@Component({
  selector: 'app-dashboard-reports-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardReportsPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'reports');
  }
}

@Component({
  selector: 'app-dashboard-settings-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardSettingsPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'settings');
  }
}

@Component({
  selector: 'app-dashboard-team-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardTeamPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'team');
  }
}

@Component({
  selector: 'app-dashboard-approvals-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardApprovalsPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'approvals');
  }
}

@Component({
  selector: 'app-dashboard-calendar-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardCalendarPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'calendar');
  }
}

@Component({
  selector: 'app-dashboard-profile-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardProfilePageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'profile');
  }
}

@Component({
  selector: 'app-dashboard-requests-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardRequestsPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'requests');
  }
}

@Component({
  selector: 'app-dashboard-history-page',
  standalone: true,
  imports: [DashboardPageComponent],
  template: '<app-dashboard-page [pageId]="pageId" [user]="user"></app-dashboard-page>'
})
export class DashboardHistoryPageComponent extends DashboardPageBase {
  constructor(router: Router, toastService: ToastService) {
    super(router, toastService, 'history');
  }
}
