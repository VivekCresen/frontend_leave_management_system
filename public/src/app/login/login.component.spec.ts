import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { AuthApiService } from '../services/auth-api.service';
import { AuthService } from '../services/auth.service';
import { LeaveApiService } from '../services/leave-api.service';
import { ToastService } from '../services/toast.service';
import { NgForm } from '@angular/forms';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let leaveService: jasmine.SpyObj<LeaveApiService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'login', 'setCurrentUser', 'clearCurrentUser', 'getDashboard', 'checkIn'
    ]);
    (authService as any).currentUser = signal(null);
    authService.getDashboard.and.returnValue(throwError(() => new Error('skip')));
    leaveService = jasmine.createSpyObj<LeaveApiService>('LeaveApiService', ['reviewLeaveFromMail']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'info']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AuthApiService, useValue: authService },
        { provide: LeaveApiService, useValue: leaveService },
        { provide: ToastService, useValue: toastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should block submit when login form is invalid', () => {
    component.onSubmit({ invalid: true } as NgForm);

    expect(component.errorMessage).toBe('Please correct the highlighted fields.');
    expect(authService.login).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledWith('Please correct the highlighted fields.');
  });

  it('should show server validation errors returned by the api', () => {
    authService.login.and.returnValue(throwError(() => ({
      error: {
        message: 'Password is required',
        errors: {
          password: 'Password is required'
        }
      }
    })));

    component.username = 'admin';
    component.password = 'admin123';

    component.onSubmit({ invalid: false } as NgForm);

    expect(component.fieldErrors['password']).toBe('Password is required');
    expect(component.errorMessage).toBe('Password is required');
  });

  it('should submit valid credentials', () => {
    authService.login.and.returnValue(of({
      username: 'admin',
      email: 'admin@cresen.com',
      role: 'ADMIN',
      active: true,
      token: 'jwt-token',
      message: 'Login successful'
    }));

    component.username = ' admin ';
    component.password = 'admin123';

    component.onSubmit({ invalid: false } as NgForm);

    expect(authService.login).toHaveBeenCalledWith({ username: 'admin', password: 'YWRtaW4xMjM=' });
    expect(authService.setCurrentUser).toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalledWith('Login successful');
  });

  it('should submit email login values too', () => {
    authService.login.and.returnValue(of({
      username: 'admin',
      email: 'admin@cresen.com',
      role: 'ADMIN',
      active: true,
      token: 'jwt-token',
      message: 'Login successful'
    }));

    component.username = ' admin@cresen.com ';
    component.password = 'admin123';

    component.onSubmit({ invalid: false } as NgForm);

    expect(authService.login).toHaveBeenCalledWith({ username: 'admin@cresen.com', password: 'YWRtaW4xMjM=' });
  });
});
