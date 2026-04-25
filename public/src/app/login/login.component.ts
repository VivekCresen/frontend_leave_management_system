import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ApiErrorResponse } from '../services/auth.service';
import { LeaveApiService } from '../services/leave-api.service';
import { ToastService } from '../services/toast.service';
import { LoaderService } from '../shared/services/loader.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  readonly usernameMaxLength = 100;
  readonly passwordMaxLength = 255;
  private readonly authService: AuthApiService;

  username = '';
  password = '';
  errorMessage = '';
  isSubmitting = false;
  submitted = false;
  fieldErrors: Record<string, string> = {};
  showPassword = false;

  constructor(
    authService: AuthApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leaveService: LeaveApiService,
    private readonly toastService: ToastService,
    private readonly loaderService: LoaderService
  ) {
    this.authService = authService;
  }

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();

    if (!currentUser?.username) {
      return;
    }

    // Already logged in — handle mail decision or redirect to dashboard
    if (!this.hasMailDecisionParams()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    if (!this.currentUserMatchesMailRole(currentUser.role)) {
      this.authService.clearCurrentUser();
      this.toastService.info('Please login with the correct role to complete this mail action.');
      return;
    }

    this.completeMailDecisionAfterLogin(currentUser.username);
  }

  onSubmit(form: NgForm): void {
    this.submitted = true;
    this.fieldErrors = {};
    this.errorMessage = '';

    this.username = this.username.trim();

    if (form.invalid) {
      this.errorMessage = 'Please correct the highlighted fields.';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isSubmitting = true;
    const encodedPassword = btoa(this.password);
    this.authService.login({ username: this.username, password: encodedPassword }).subscribe({
      next: (response) => {
        this.clearPasswordFields();
        if (!response.active) {
          this.isSubmitting = false;
          this.authService.clearCurrentUser();
          this.errorMessage = 'Your account is inactive. Please contact an administrator.';
          this.toastService.error(this.errorMessage);
          return;
        }

        this.isSubmitting = false;
        this.authService.setCurrentUser(response);
        this.completeMailDecisionAfterLogin(response.username);
      },
      error: (err: { error?: ApiErrorResponse & { error?: string } }) => {
        this.isSubmitting = false;
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || err.error?.error || this.firstFieldError() || 'Invalid username or password';
        this.toastService.error(this.errorMessage);
        this.clearPasswordFields();
      }
    });
  }

  getUsernameError(control: NgModel): string | null {
    if (this.fieldErrors['username']) {
      return this.fieldErrors['username'];
    }

    if (!this.shouldShowControlError(control)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Username or email is required';
    }

    if (control.errors?.['maxlength']) {
      return `Username or email must not exceed ${this.usernameMaxLength} characters`;
    }

    return null;
  }

  getPasswordError(control: NgModel): string | null {
    if (this.fieldErrors['password']) {
      return this.fieldErrors['password'];
    }

    if (!this.shouldShowControlError(control)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Password is required';
    }

    if (control.errors?.['maxlength']) {
      return `Password must not exceed ${this.passwordMaxLength} characters`;
    }

    return null;
  }

  private shouldShowControlError(control: NgModel): boolean {
    return control.invalid === true
      && (control.touched === true || control.dirty === true || this.submitted);
  }

  private firstFieldError(): string | null {
    const [firstError] = Object.values(this.fieldErrors);
    return firstError ?? null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  navigateToForgotPassword(event?: Event): void {
    event?.preventDefault();
    this.router.navigate(['/forgot-password']);
  }

  private clearPasswordFields(): void {
    this.password = '';
    this.showPassword = false;
  }

  private clearValidationErrors(): void {
    this.errorMessage = '';
    this.fieldErrors = {};
  }

  private completeMailDecisionAfterLogin(actorUsername: string): void {
    const leaveId = Number(this.route.snapshot.queryParamMap.get('mailLeaveId'));
    const decision = this.route.snapshot.queryParamMap.get('mailDecision');
    if (!leaveId || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      this.toastService.success('Login successful');
      this.router.navigate(['/dashboard']);
      return;
    }

    const rejectionReason = decision === 'REJECTED'
      ? window.prompt('Please enter rejection reason', 'Rejected from email approval link.') ?? ''
      : undefined;

    this.isSubmitting = true;

    this.leaveService.reviewLeaveFromMail(leaveId, {
      actorUsername,
      decision,
      rejectionReason
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastService.success(`Leave ${decision.toLowerCase()} successfully`);
        this.router.navigate(['/dashboard', 'approvals']);
      },
      error: (err: { error?: { details?: string[]; message?: string; error?: string } }) => {
        this.isSubmitting = false;
        const details = err.error?.details ?? [];
        this.errorMessage = this.formatMailDecisionErrorMessage(
          details[0] || err.error?.message || err.error?.error || 'Leave action failed.'
        );
        this.toastService.error(this.errorMessage);
        this.router.navigate(['/dashboard', 'approvals']);
      }
    });
  }

  private hasMailDecisionParams(): boolean {
    const leaveId = Number(this.route.snapshot.queryParamMap.get('mailLeaveId'));
    const decision = this.route.snapshot.queryParamMap.get('mailDecision');
    return Boolean(leaveId) && (decision === 'APPROVED' || decision === 'REJECTED');
  }

  private currentUserMatchesMailRole(currentRole: string | undefined): boolean {
    const expectedRole = this.route.snapshot.queryParamMap.get('mailRole');
    const normalizedRole = (currentRole ?? '').trim().toUpperCase();

    if (!expectedRole || expectedRole === 'MANAGER_OR_ADMIN') {
      return normalizedRole === 'MANAGER' || normalizedRole === 'ADMIN';
    }

    return normalizedRole === expectedRole.trim().toUpperCase();
  }

  private formatMailDecisionErrorMessage(message: string): string {
    const normalized = message.trim();

    if (/already\s+APPROVED\s+and cannot be changed from email/i.test(normalized)) {
      return 'This leave request was already approved.';
    }

    if (/already\s+REJECTED\s+and cannot be changed from email/i.test(normalized)) {
      return 'This leave request was already rejected.';
    }

    if (/already\s+MANAGER_APPROVED\s+and cannot be changed from email/i.test(normalized)) {
      return 'This leave request already moved to admin review.';
    }

    if (/already\s+\w+\s+and cannot be changed from email/i.test(normalized)) {
      return 'This leave request was already updated.';
    }

    if (/Only an ADMIN can give final approval or rejection/i.test(normalized)) {
      return 'Please sign in with an admin account to complete this action.';
    }

    if (/Only a MANAGER or ADMIN can approve or reject/i.test(normalized)) {
      return 'Please sign in with a manager or admin account to complete this action.';
    }

    if (/assigned to .* not /i.test(normalized)) {
      return 'This leave request is assigned to a different approver.';
    }

    if (/Please login before approving or rejecting leave/i.test(normalized)) {
      return 'Please log in first to complete this action.';
    }

    if (/Inactive users cannot approve or reject leave/i.test(normalized)) {
      return 'Your account is inactive. Please contact an administrator.';
    }

    return normalized;
  }
}
