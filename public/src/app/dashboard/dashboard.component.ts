import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, HostListener } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthApiService } from '../services/auth-api.service';
import { LoginResponse } from '../services/auth.service';
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
  private readonly authService: AuthApiService;
  private readonly mobileBreakpoint = 860;

  isSidebarCollapsed = false;
  isMobileViewport = false;
  isMobileSidebarOpen = false;

  constructor(
    authService: AuthApiService,
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    this.authService = authService;
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

    this.syncViewportState();
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

  get sidebarToggleLabel(): string {
    if (this.isMobileViewport) {
      return this.isMobileSidebarOpen ? 'Close sidebar menu' : 'Open sidebar menu';
    }

    return this.isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncViewportState();
  }

  toggleSidebar(): void {
    if (this.isMobileViewport) {
      this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
      return;
    }

    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  handleMenuNavigation(): void {
    if (this.isMobileViewport) {
      this.closeMobileSidebar();
    }
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

  private syncViewportState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint;
    this.isMobileViewport = isMobileViewport;

    if (!isMobileViewport) {
      this.isMobileSidebarOpen = false;
    }
  }
}
