import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ApiErrorResponse } from '../services/auth.service';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STRICT_PASSWORD_MESSAGE,
  STRICT_PASSWORD_PATTERN,
  STRICT_PASSWORD_REGEX,
  STRICT_PASSWORD_RULES,
  getStrictPasswordError
} from '../shared/password-policy';
import { ToastService } from '../services/toast.service';
import { LoaderService } from '../shared/services/loader.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  readonly emailMaxLength = 100;
  readonly otpLength = 6;
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  readonly strictPasswordPattern = STRICT_PASSWORD_PATTERN;
  private readonly authService: AuthApiService;

  currentStep = 1;
  email = '';
  otp = '';
  newPassword = '';
  confirmPassword = '';

  errorMessage = '';
  successMessage = '';
  isLoading = false;
  stepOneSubmitted = false;
  stepTwoSubmitted = false;
  stepThreeSubmitted = false;
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
  }

  requestOtp(form: NgForm): void {
    this.stepOneSubmitted = true;
    this.clearMessages();
    this.email = this.normalizeEmail(this.email);

    if (form.invalid) {
      this.errorMessage = 'Please correct the highlighted fields.';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.authService.requestResetOtp(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loaderService.hide();
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

  verifyOtp(form: NgForm): void {
    this.stepTwoSubmitted = true;
    this.clearMessages();
    this.email = this.normalizeEmail(this.email);
    this.otp = this.normalizeOtp(this.otp);

    if (form.invalid) {
      this.errorMessage = 'Please correct the highlighted fields.';
      this.toastService.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.loaderService.show();
    this.authService.verifyOtp(this.email, this.otp).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = {};
        this.successMessage = response.message;
        this.toastService.success(response.message);
        this.currentStep = 3;
        this.stepThreeSubmitted = false;
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || this.firstFieldError() || 'Unable to verify OTP.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  resetPassword(form: NgForm): void {
    this.stepThreeSubmitted = true;
    this.clearMessages();
    this.email = this.normalizeEmail(this.email);
    this.otp = this.normalizeOtp(this.otp);

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
    this.loaderService.show();
    const encodedPassword = btoa(this.newPassword);
    this.authService.resetPassword(this.email, this.otp, encodedPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = {};
        this.clearSensitiveFields();
        this.authService.clearCurrentUser();
        this.successMessage = 'Password reset successfully. Redirecting to login...';
        this.toastService.success('Password reset successfully');
        setTimeout(() => this.router.navigate(['/login']), 1800);
      },
      error: (err: { error?: ApiErrorResponse }) => {
        this.isLoading = false;
        this.loaderService.hide();
        this.fieldErrors = err.error?.errors ?? {};
        this.errorMessage = err.error?.message || this.firstFieldError() || 'Unable to reset password right now.';
        this.toastService.error(this.errorMessage);
      }
    });
  }

  resendOtp(): void {
    this.stepOneSubmitted = true;
    this.clearMessages();
    this.email = this.normalizeEmail(this.email);

    const emailError = this.getEmailValidationMessage();
    if (emailError) {
      this.errorMessage = emailError;
      this.toastService.error(emailError);
      return;
    }

    this.isLoading = true;
    this.authService.requestResetOtp(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loaderService.hide();
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
    this.otp = this.normalizeOtp(this.otp);
  }

  goToEmailStep(): void {
    this.currentStep = 1;
    this.stepTwoSubmitted = false;
    this.stepThreeSubmitted = false;
    this.clearSensitiveFields();
    this.fieldErrors = {};
    this.errorMessage = '';
    this.successMessage = '';
  }

  goToOtpStep(): void {
    this.currentStep = 2;
    this.stepTwoSubmitted = false;
    this.stepThreeSubmitted = false;
    this.clearSensitiveFields();
    this.fieldErrors = {};
    this.errorMessage = '';
    this.successMessage = '';
  }

  getEmailError(control: NgModel): string | null {
    if (this.fieldErrors['email']) {
      return this.fieldErrors['email'];
    }

    if (!this.shouldShowControlError(control, this.stepOneSubmitted)) {
      return null;
    }

    return this.getEmailValidationMessage();
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

    if (!this.shouldShowControlError(control, this.stepThreeSubmitted)) {
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
    if (!this.shouldShowControlError(control, this.stepThreeSubmitted) && !this.passwordsDoNotMatch()) {
      return null;
    }

    if (control.errors?.['required']) {
      return 'Please confirm your new password';
    }

    if (this.passwordsDoNotMatch()) {
      return 'Passwords do not match';
    }

    return null;
  }

  private getEmailValidationMessage(): string | null {
    if (!this.email) {
      return 'Email is required';
    }

    if (this.email.length > this.emailMaxLength) {
      return `Email must not exceed ${this.emailMaxLength} characters`;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(this.email)) {
      return 'Please provide a valid email address';
    }

    return null;
  }

  private passwordsDoNotMatch(): boolean {
    return !!this.confirmPassword && this.newPassword !== this.confirmPassword;
  }

  private hasInvalidPassword(): boolean {
    return getStrictPasswordError(this.newPassword) !== null;
  }

  private shouldShowControlError(control: NgModel, submitted: boolean): boolean {
    return control.invalid === true
      && (control.touched === true || control.dirty === true || submitted);
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeOtp(value: string): string {
    return value.replace(/\D/g, '').slice(0, this.otpLength);
  }

  private firstFieldError(): string | null {
    const [firstError] = Object.values(this.fieldErrors);
    return firstError ?? null;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.fieldErrors = {};
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

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
