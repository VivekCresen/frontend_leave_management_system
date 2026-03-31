import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { ApiErrorResponse } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
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
    private readonly router: Router,
    private readonly toastService: ToastService
  ) {
    this.authService = authService;
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
        this.toastService.success('Login successful');
        this.router.navigate(['/dashboard']);
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
}
