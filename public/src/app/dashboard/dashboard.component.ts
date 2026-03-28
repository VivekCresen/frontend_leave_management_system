import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LoginResponse, injectAuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { getDashboardMenuItems, getDefaultDashboardPage, isDashboardPageAllowed } from './dashboard.config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly authService = injectAuthService();

  constructor(
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
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

    this.ensureValidRoute();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.ensureValidRoute());
  }

  get currentUser(): LoginResponse | null {
    return this.authService.currentUser();
  }

  get menuItems() {
    return getDashboardMenuItems(this.currentUser?.role);
  }

  logout(): void {
    this.authService.clearCurrentUser();
    this.toastService.info('Logged out successfully');
    this.router.navigate(['/login']);
  }

  private ensureValidRoute(): void {
    const user = this.currentUser;
    if (!user) {
      return;
    }

    const currentPage = this.router.url.split('/dashboard/')[1]?.split(/[?#]/)[0] ?? '';
    const fallbackPage = getDefaultDashboardPage(user.role);

    if (!currentPage || !isDashboardPageAllowed(user.role, currentPage)) {
      this.router.navigate(['/dashboard', fallbackPage]);
    }
  }
}
