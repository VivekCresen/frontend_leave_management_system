import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { AuthApiService } from '../services/auth-api.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { NgForm } from '@angular/forms';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['requestResetOtp', 'resetPassword', 'clearCurrentUser']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: authService },
        { provide: ToastService, useValue: toastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should block otp request when the email form is invalid', () => {
    component.requestOtp({ invalid: true } as NgForm);

    expect(component.errorMessage).toBe('Please correct the highlighted fields.');
    expect(authService.requestResetOtp).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledWith('Please correct the highlighted fields.');
  });

  it('should sanitize otp input to digits only', () => {
    component.otp = '12a34b567';

    component.onOtpInput();

    expect(component.otp).toBe('123456');
  });

  it('should block password reset when passwords do not match', () => {
    component.email = 'employee@cresen.com';
    component.otp = '123456';
    component.newPassword = 'NewPass@123';
    component.confirmPassword = 'different123';

    component.resetPassword({ invalid: false } as NgForm);

    expect(authService.resetPassword).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Passwords do not match');
    expect(toastService.error).toHaveBeenCalledWith('Passwords do not match');
  });

  it('should submit normalized email when requesting otp', () => {
    authService.requestResetOtp.and.returnValue(of({ message: 'OTP sent to your email address.' }));
    component.email = ' Employee@Cresen.com ';

    component.requestOtp({ invalid: false } as NgForm);

    expect(authService.requestResetOtp).toHaveBeenCalledWith('employee@cresen.com');
    expect(component.currentStep).toBe(2);
    expect(toastService.success).toHaveBeenCalledWith('OTP sent to your email address.');
  });

  it('should show a reset-specific fallback message when reset fails without a backend message', () => {
    authService.resetPassword.and.returnValue(throwError(() => ({ error: {} })));
    component.email = 'employee@cresen.com';
    component.otp = '123456';
    component.newPassword = 'NewPass@123';
    component.confirmPassword = 'NewPass@123';

    component.resetPassword({ invalid: false } as NgForm);

    expect(component.errorMessage).toBe('Unable to reset password right now.');
    expect(toastService.error).toHaveBeenCalledWith('Unable to reset password right now.');
  });
});
