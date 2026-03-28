import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { AuthApiService } from './services/auth-api.service';
import { AUTH_SERVICE } from './services/auth.service';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    providers: [{ provide: AUTH_SERVICE, useExisting: AuthApiService }]
  },
  {
    path: 'forgot-password',
    providers: [{ provide: AUTH_SERVICE, useExisting: AuthApiService }],
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'change-password',
    component: ChangePasswordComponent,
    providers: [{ provide: AUTH_SERVICE, useExisting: AuthApiService }]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    providers: [{ provide: AUTH_SERVICE, useExisting: AuthApiService }],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardOverviewPageComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardUsersPageComponent)
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardRolesPageComponent)
      },
      {
        path: 'leaves',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardLeavesPageComponent)
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardReportsPageComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardSettingsPageComponent)
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardTeamPageComponent)
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardApprovalsPageComponent)
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardCalendarPageComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardProfilePageComponent)
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardRequestsPageComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./dashboard/pages/dashboard-pages.component').then((m) => m.DashboardHistoryPageComponent)
      }
    ]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
