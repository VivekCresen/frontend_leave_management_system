import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { AuthApiService } from '../../services/auth-api.service';
import { LoginResponse, ManagedUser, AttendanceLogDto } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { getInitials } from '../../commons/string.util';

@Component({
  selector: 'app-dashboard-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-card">
      <div class="profile-card-header">
        <div>
          <p class="eyebrow">My Profile</p>
          <h3>Account details</h3>
          <p class="body-copy">Your personal information and account settings.</p>
        </div>
        <div class="profile-header-actions">
          <button type="button" class="check-in-btn primary-button" 
                  [disabled]="isCheckingIn || (!!todayStatus && !todayStatus.checkOutTime)"
                  (click)="checkIn()">
            <i class="fas fa-sign-in-alt"></i>
            <span>{{ (!!todayStatus && !todayStatus.checkOutTime) ? 'Checked In' : 'Check In' }}</span>
          </button>
          
          <button type="button" class="check-out-btn secondary-button" 
                  [disabled]="isCheckingOut || !todayStatus || !!todayStatus.checkOutTime"
                  (click)="checkOut()">
            <i class="fas fa-sign-out-alt"></i>
            <span>{{ !!todayStatus?.checkOutTime ? 'Checked Out' : 'Check Out' }}</span>
          </button>

          <button type="button" class="edit-profile-btn" (click)="editProfileRequested.emit()">
            <i class="fas fa-user-pen"></i>
            <span>Edit profile</span>
          </button>
        </div>
      </div>

      <div class="profile-banner">
        <div class="profile-banner-avatar">{{ profileInitials }}</div>
        <div class="profile-banner-info">
          <strong>{{ actor?.fullName || user.username }}</strong>
          <span>{{ user.email }}</span>
          <div class="profile-banner-badges">
            <span class="profile-role-badge">{{ actor?.role || user.role }}</span>
            <span class="profile-status-badge"
              [class.active-badge]="user.active"
              [class.inactive-badge]="!user.active">
              <i class="fas fa-circle"></i>
              {{ user.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </div>

      <div class="profile-grid">
        <div class="profile-field-card">
          <span>Full name</span>
          <strong>{{ actor?.fullName || user.username }}</strong>
        </div>
        <div class="profile-field-card">
          <span>Username</span>
          <strong>{{ user.username }}</strong>
        </div>
        <div class="profile-field-card">
          <span>Email</span>
          <strong>{{ user.email }}</strong>
        </div>
        <div class="profile-field-card">
          <span>Company ID</span>
          <strong>{{ actor?.companyId || 'Not assigned' }}</strong>
        </div>
        <div class="profile-field-card">
          <span>Gender</span>
          <strong>{{ actor?.gender || 'Not provided' }}</strong>
        </div>
        <div class="profile-field-card">
          <span>Assigned manager</span>
          <strong>{{ actor?.createdBy || 'System' }}</strong>
        </div>
      </div>
      
      <div class="attendance-summary-card" *ngIf="todayStatus">
        <div class="attendance-info">
          <i class="fas fa-clock text-blue"></i>
          <div>
            <strong>Today's Check-In</strong>
            <p>{{ todayStatus.checkInTime | date:'shortTime' }}</p>
          </div>
        </div>
        <div class="attendance-info" *ngIf="todayStatus.checkOutTime">
          <i class="fas fa-check-circle text-green"></i>
          <div>
            <strong>Today's Check-Out</strong>
            <p>{{ todayStatus.checkOutTime | date:'shortTime' }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .profile-card {
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 20px;
      background: #ffffff;
      padding: 16px 20px 20px;
      box-shadow: 0 1px 4px rgba(15,23,42,0.06), 0 12px 40px -20px rgba(15,23,42,0.14);
      display: flex;
      flex-direction: column;
    }

    .profile-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.85);
      margin-bottom: 1.25rem;
    }
    .profile-card-header .eyebrow {
      margin: 0;
      color: #0f8b8d;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .profile-card-header h3 {
      margin: 2px 0 0;
      color: #0f172a;
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .profile-card-header .body-copy {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 0.85rem;
      line-height: 1.45;
    }
    .profile-header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .check-in-btn, .check-out-btn, .edit-profile-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.4rem 0.875rem;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s, box-shadow 0.15s;
    }
    .check-in-btn {
      background: linear-gradient(160deg, #0f8b8d, #155e75);
      color: #fff;
      border: none;
      box-shadow: 0 2px 8px rgba(15,139,141,0.25);
    }
    .check-in-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
    .check-out-btn {
      background: transparent;
      color: #f97316;
      border: 1px solid rgba(249,115,22,0.5);
    }
    .check-out-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .edit-profile-btn {
      background: transparent;
      border: 1px solid rgba(148,163,184,0.4);
      color: #475569;
    }
    .edit-profile-btn:hover { border-color: #0f8b8d; color: #0f8b8d; background: rgba(15,139,141,0.06); }

    .profile-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
      padding: 0.875rem 1rem;
      border-radius: 12px;
      background: rgba(15,139,141,0.05);
      border: 1px solid rgba(226, 232, 240, 0.85);
    }
    .profile-banner-avatar {
      width: 3.25rem; height: 3.25rem; border-radius: 50%;
      background: rgba(15,139,141,0.12); color: #0f8b8d;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; font-weight: 800;
      border: 2px solid rgba(15,139,141,0.3);
      flex-shrink: 0;
    }
    .profile-banner-info { display: flex; flex-direction: column; gap: 0.15rem; }
    .profile-banner-info strong { font-size: 1rem; font-weight: 700; color: #0f172a; }
    .profile-banner-info > span { font-size: 0.8125rem; color: #64748b; }
    .profile-banner-badges { display: flex; gap: 0.4rem; margin-top: 0.3rem; flex-wrap: wrap; }
    .profile-role-badge, .profile-status-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.1rem 0.55rem; border-radius: 9999px;
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    }
    .profile-role-badge { background: rgba(15,139,141,0.1); color: #0f8b8d; border: 1px solid rgba(15,139,141,0.2); }
    .profile-status-badge.active-badge { background: #dcfce7; color: #166534; }
    .profile-status-badge.active-badge i { color: #22c55e; font-size: 0.4rem; }
    .profile-status-badge.inactive-badge { background: #fee2e2; color: #991b1b; }
    .profile-status-badge.inactive-badge i { color: #ef4444; font-size: 0.4rem; }

    .profile-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    .profile-field-card {
      padding: 0.875rem 1rem;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid rgba(226, 232, 240, 0.8);
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .profile-field-card span {
      font-size: 0.72rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.09em;
      color: #64748b;
    }
    .profile-field-card strong { font-size: 0.92rem; color: #0f172a; font-weight: 600; }

    .attendance-summary-card {
      display: flex;
      gap: 2rem;
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
      border-radius: 12px;
      background: rgba(15,139,141,0.05);
      border: 1px solid rgba(15,139,141,0.12);
    }
    .attendance-info { display: flex; align-items: center; gap: 0.625rem; }
    .attendance-info i { font-size: 1.25rem; }
    .text-blue { color: #3b82f6; }
    .text-green { color: #10b981; }
    .attendance-info strong {
      display: block; font-size: 0.68rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;
    }
    .attendance-info p { margin: 0.1rem 0 0; font-weight: 700; font-size: 0.9rem; color: #0f172a; }

    [data-theme="dark"] .profile-card { background: var(--surface-bg); border-color: var(--surface-border); box-shadow: var(--surface-shadow); }
    [data-theme="dark"] .profile-card-header { border-bottom-color: var(--surface-border); }
    [data-theme="dark"] .profile-card-header h3 { color: var(--surface-heading); }
    [data-theme="dark"] .profile-card-header .eyebrow,
    [data-theme="dark"] .profile-card-header .body-copy { color: var(--surface-body); }
    [data-theme="dark"] .profile-banner { background: rgba(15,139,141,0.08); border-color: rgba(15,139,141,0.15); }
    [data-theme="dark"] .profile-banner-info strong { color: var(--surface-heading); }
    [data-theme="dark"] .profile-banner-info > span { color: var(--surface-body); }
    [data-theme="dark"] .profile-field-card { background: rgba(15,23,42,0.4); border-color: var(--surface-border); }
    [data-theme="dark"] .profile-field-card span { color: var(--surface-body); }
    [data-theme="dark"] .profile-field-card strong { color: var(--surface-heading); }
    [data-theme="dark"] .attendance-summary-card { background: rgba(15,139,141,0.08); border-color: rgba(15,139,141,0.15); }
    [data-theme="dark"] .attendance-info strong { color: var(--surface-body); }
    [data-theme="dark"] .attendance-info p { color: var(--surface-heading); }
    [data-theme="dark"] .edit-profile-btn { border-color: var(--surface-border); color: var(--surface-body); }

    @media (max-width: 640px) {
      .profile-grid { grid-template-columns: 1fr 1fr; }
      .profile-card-header { flex-direction: column; align-items: flex-start; }
      .profile-header-actions { justify-content: flex-start; }
    }
  `]
})
export class DashboardProfileComponent implements OnInit {
  @Input({ required: true }) user!: LoginResponse;
  @Input() actor: ManagedUser | null = null;
  
  @Output() editProfileRequested = new EventEmitter<void>();

  private readonly authService = inject(AuthApiService);
  private readonly toastService = inject(ToastService);

  todayStatus: AttendanceLogDto | null = null;
  isCheckingIn = false;
  isCheckingOut = false;

  get profileInitials(): string {
    return getInitials(this.actor?.fullName ?? this.user.username);
  }

  ngOnInit(): void {
    if (this.user?.username) {
      this.loadTodayStatus();
    }
  }

  loadTodayStatus(): void {
    this.authService.getTodayStatus(this.user.username).subscribe({
      next: (status) => {
        this.todayStatus = status;
      },
      error: () => {
        this.todayStatus = null;
      }
    });
  }

  checkIn(): void {
    if (this.isCheckingIn || this.todayStatus) return;
    this.isCheckingIn = true;
    this.authService.checkIn(this.user.username).subscribe({
      next: (status) => {
        this.isCheckingIn = false;
        this.todayStatus = status;
        this.toastService.success('Checked in successfully!');
      },
      error: (err) => {
        this.isCheckingIn = false;
        const msg = err.error?.message || 'Check in failed.';
        this.toastService.error(msg);
      }
    });
  }

  checkOut(): void {
    if (this.isCheckingOut || !this.todayStatus || this.todayStatus.checkOutTime) return;
    this.isCheckingOut = true;
    this.authService.checkOut(this.user.username).subscribe({
      next: (status) => {
        this.isCheckingOut = false;
        this.todayStatus = status;
        this.toastService.success('Checked out successfully!');
      },
      error: (err) => {
        this.isCheckingOut = false;
        const msg = err.error?.message || 'Check out failed.';
        this.toastService.error(msg);
      }
    });
  }
}
