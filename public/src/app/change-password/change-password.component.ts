import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ApiErrorResponse } from '../services/auth.service';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STRICT_PASSWORD_MESSAGE,
  STRICT_PASSWORD_REGEX,
  STRICT_PASSWORD_RULES,
  getStrictPasswordError
} from '../shared/password-policy';
import { ToastService } from '../services/toast.service';
import { LoaderService } from '../shared/services/loader.service';
import { shouldShowControlError, firstFieldError, normalizeOtp, clearFormMessages } from '../commons/form.util';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent {
  readonly otpLength = 6;
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  readonly strictPasswordPattern = STRICT_PASSWORD_REGEX;
  private readonly authService: AuthApiService;

  currentStep = 1;
  otp = '';
  newPassword = '';
  confirmPassword = '';

  errorMessage = '';
  successMessage = '';
  isLoading = false;
  stepOneSubmitted = false;
  stepTwoSubmitted = false;
  fieldErrors: Record<string, string> = {};
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    authService: AuthApiService,
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly loaderService: LoaderService
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
    }
  }

  get userEmail(): string {
    return this.authService.currentUser()?.email || '';
  }

  requestOtp(): void {
    this.stepOneSubmitted = true;
    this.clearMessages();

    if (!this.userEmail) {
      this.errorMessage = 'User email not found';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.loaderService.show();
    this.authService.requestResetOtp(this.userEmail).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.currentStep = 2;
        this.stepTwoSubmitted = false;
        this.fieldErrors = {};
        this.successMessage = response.message;
        this.toastService.success(response.message);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || this.firstFieldError() || 'Unable to send OTP right now.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  changePassword(form: NgForm): void {
    this.stepTwoSubmitted = true;
    this.clearMessages();
    this.otp = normalizeOtp(this.otp, this.otpLength);

    if (this.hasInvalidPassword()) {
      this.errorMessage = 'Please enter a valid password.';
      this.toastService.error(this.getPasswordRequirementsToastMessage());
      return;
    }

    if (this.passwordsDoNotMatch()) {
      this.errorMessage = 'Passwords do not match';
      this.toastService.error(this.errorMessage);
      return;
    }

    if (form.invalid) {
      this.errorMessage = 'Please correct the highlighted fields.';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    const encodedPassword = btoa(this.newPassword);
    this.authService.resetPassword(this.userEmail, this.otp, encodedPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.fieldErrors = {};
        this.clearSensitiveFields();
        this.successMessage = 'Password changed successfully. Redirecting...';
        this.toastService.success('Password changed successfully');
        setTimeout(() => this.router.navigate(['/dashboard']), 1800);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || this.firstFieldError() || 'Unable to change password.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  resendOtp(): void {
    this.stepOneSubmitted = true;
    this.clearMessages();

    if (!this.userEmail) {
      this.errorMessage = 'User email not found';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.loaderService.show();
    this.authService.requestResetOtp(this.userEmail).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.fieldErrors = {};
        this.successMessage = response.message;
        this.toastService.success(response.message);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || this.firstFieldError() || 'Unable to send OTP right now.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  onOtpInput(): void {
    this.otp = normalizeOtp(this.otp, this.otpLength);
  }

  goToOtpStep(): void {
    this.currentStep = 1;
    this.stepTwoSubmitted = false;
    this.clearSensitiveFields();
    this.fieldErrors = {};
    this.errorMessage = '';
    this.successMessage = '';
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  getOtpError(control: NgModel): string | null {
    if (this.fieldErrors['otp']) {
      return this.fieldErrors['otp'];
    }

    if (!this.shouldShowControlError(control, this.stepTwoSubmitted)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'OTP is required';
    }

    if (control.errors?.['pattern']) {
      return 'OTP must be 6 digits';
    }

    return null;
  }

  getNewPasswordError(control: NgModel): string | null {
    if (this.fieldErrors['newPassword']) {
      return this.fieldErrors['newPassword'];
    }

    if (!this.shouldShowControlError(control, this.stepTwoSubmitted)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'New password is required';
    }

    if (control.errors?.['pattern']) {
      return STRICT_PASSWORD_MESSAGE;
    }

    return getStrictPasswordError(this.newPassword);
  }

  getConfirmPasswordError(control: NgModel): string | null {
    if (this.fieldErrors['confirmPassword']) {
      return this.fieldErrors['confirmPassword'];
    }

    if (!this.shouldShowControlError(control, this.stepTwoSubmitted)) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Confirm password is required';
    }

    if (control.errors?.['maxlength']) {
      return `Password must not exceed ${this.passwordMaxLength} characters`;
    }

    if (this.passwordsDoNotMatch()) {
      return 'Passwords do not match';
    }

    return null;
  }

  private passwordsDoNotMatch(): boolean {
    return this.newPassword !== this.confirmPassword && this.newPassword.length > 0 && this.confirmPassword.length > 0;
  }

  private hasInvalidPassword(): boolean {
    return getStrictPasswordError(this.newPassword) !== null;
  }

  private shouldShowControlError(control: NgModel, submitted: boolean): boolean {
    return shouldShowControlError(control, submitted);
  }

  private firstFieldError(): string | null {
    return firstFieldError(this.fieldErrors);
  }

  private clearMessages(): void {
    clearFormMessages(this);
  }

  private clearSensitiveFields(): void {
    this.newPassword = '';
    this.confirmPassword = '';
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  private getPasswordRequirementsToastMessage(): string {
    return ['Password requirements', ...STRICT_PASSWORD_RULES].join('\n');
  }
}
