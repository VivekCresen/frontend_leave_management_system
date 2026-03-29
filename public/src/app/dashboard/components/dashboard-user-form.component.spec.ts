import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgForm, NgModel } from '@angular/forms';
import { DashboardUserFormComponent } from './dashboard-user-form.component';

describe('DashboardUserFormComponent', () => {
  let component: DashboardUserFormComponent;
  let fixture: ComponentFixture<DashboardUserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardUserFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardUserFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('assignableRoles', ['EMPLOYEE']);
    fixture.componentRef.setInput('users', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a username length error after the field is edited', () => {
    component.model.username = 'ab';

    const control = createControl({ dirty: true });

    expect(component.getControlError(control, 'username', 'Username is required'))
      .toBe('Username must be 3 to 100 characters');
  });

  it('should show a username character error after the field is edited', () => {
    component.model.username = 'user name';

    const control = createControl({ dirty: true });

    expect(component.getControlError(control, 'username', 'Username is required'))
      .toBe('Username must use letters, numbers, dot, underscore, or hyphen only');
  });

  it('should emit a trimmed and normalized payload when the form is valid', () => {
    spyOn(component.saveRequested, 'emit');
    component.model = {
      companyId: ' CRESEN004 ',
      fullName: ' Test Employee ',
      username: ' test.user ',
      email: ' Test.User@Cresen.com ',
      password: 'TempPass@123',
      role: 'EMPLOYEE',
      active: true,
      gender: 'Female'
    };

    component.submit({ invalid: false } as NgForm);

    expect(component.saveRequested.emit).toHaveBeenCalledWith({
      userId: undefined,
      payload: {
        companyId: 'CRESEN004',
        fullName: 'Test Employee',
        username: 'test.user',
        email: 'test.user@cresen.com',
        password: 'TempPass@123',
        role: 'EMPLOYEE',
        active: true,
        gender: 'Female'
      }
    });
  });

  it('should not emit when the username contains invalid characters', () => {
    spyOn(component.saveRequested, 'emit');
    component.model = {
      companyId: 'CRESEN004',
      fullName: 'Test Employee',
      username: 'test user',
      email: 'test.user@cresen.com',
      password: 'TempPass@123',
      role: 'EMPLOYEE',
      active: true,
      gender: 'Female'
    };

    component.submit({ invalid: false } as NgForm);

    expect(component.saveRequested.emit).not.toHaveBeenCalled();
  });
});

function createControl(overrides: Partial<NgModel> = {}): NgModel {
  return {
    dirty: false,
    touched: false,
    invalid: false,
    errors: null,
    ...overrides
  } as NgModel;
}
