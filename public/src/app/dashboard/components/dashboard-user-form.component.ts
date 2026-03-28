import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { ManagedUser, UserManagementPayload } from '../../services/auth.service';
import {
  PASSWORD_MAX_LENGTH,
  STRICT_PASSWORD_MESSAGE,
  getStrictPasswordError
} from '../../shared/password-policy';

type UserFormModel = {
  companyId: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
  gender: string;
};

type TrimmedField = 'companyId' | 'fullName' | 'username' | 'email';

export interface DashboardUserSubmitEvent {
  userId?: number;
  payload: UserManagementPayload;
}

@Component({
  selector: 'app-dashboard-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-user-form.component.html',
  styleUrls: ['./dashboard-user-form.component.css']
})
export class DashboardUserFormComponent implements OnChanges {
  readonly usernamePattern = '^[A-Za-z0-9._-]{3,100}$';
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  readonly passwordRuleText = STRICT_PASSWORD_MESSAGE;
  readonly genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  readonly trimValidatedFields: TrimmedField[] = ['companyId', 'fullName', 'username', 'email'];

  @Input({ required: true }) assignableRoles: string[] = [];
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() cancelRequested = new EventEmitter<void>();

  @ViewChild('userForm') private userForm?: NgForm;

  submitted = false;
  showPassword = false;
  model: UserFormModel = this.createDefaultModel();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingUser']) {
      this.syncModelFromInputs();
      return;
    }

    if (changes['assignableRoles']) {
      this.ensureValidRoleSelection();
    }
  }

  get isEditMode(): boolean {
    return this.editingUser !== null;
  }

  get formTitle(): string {
    return this.isEditMode ? 'Update user' : 'Create user';
  }

  get formDescription(): string {
    return this.isEditMode
      ? 'Edit the selected account. Leave password empty if you do not want to change it.'
      : 'Create a new account with the correct role, status, and company details.';
  }

  submit(form: NgForm): void {
    this.submitted = true;
    this.normalizeTrimmedFields();

    if (form.invalid || this.hasWhitespaceOnlyErrors() || !!this.getPasswordError()) {
      return;
    }

    this.saveRequested.emit({
      userId: this.editingUser?.id,
      payload: {
        companyId: this.model.companyId.trim(),
        fullName: this.model.fullName.trim(),
        username: this.model.username.trim(),
        email: this.model.email.trim().toLowerCase(),
        password: this.model.password,
        role: this.model.role,
        active: this.model.active,
        gender: this.model.gender
      }
    });
  }

  cancelEdit(): void {
    this.cancelRequested.emit();
    this.submitted = false;
    this.showPassword = false;
  }

  getFieldError(field: keyof UserFormModel): string | null {
    return this.fieldErrors[field] ?? null;
  }

  getControlError(control: NgModel | null, field: keyof UserFormModel, fallback: string): string | null {
    if (this.getFieldError(field)) {
      return this.getFieldError(field);
    }

    if (this.requiresTrimmedValue(field) && this.shouldShowTrimmedRequired(field, control)) {
      return fallback;
    }

    if (!control || !this.shouldShowControlError(control)) {
      return null;
    }

    if (control.errors?.['required']) {
      return fallback;
    }

    if (control.errors?.['maxlength']) {
      return `Maximum ${control.errors['maxlength'].requiredLength} characters allowed`;
    }

    if (control.errors?.['email']) {
      return 'Enter a valid email address';
    }

    if (control.errors?.['pattern']) {
      return 'Username must be 3 to 100 characters and use letters, numbers, dot, underscore, or hyphen';
    }

    return null;
  }

  isFieldInvalid(control: NgModel | null, field: keyof UserFormModel, fallback: string): boolean {
    return this.getControlError(control, field, fallback) !== null;
  }

  getPasswordError(): string | null {
    if (this.getFieldError('password')) {
      return this.getFieldError('password');
    }

    if (!this.submitted && !this.model.password) {
      return null;
    }

    if (this.isEditMode && !this.model.password) {
      return null;
    }

    return getStrictPasswordError(this.model.password);
  }

  roleLabel(role: string): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  normalizeField(field: TrimmedField): void {
    this.model[field] = this.model[field].trim();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private syncModelFromInputs(): void {
    this.model = this.editingUser
      ? {
          companyId: this.editingUser.companyId ?? '',
          fullName: this.editingUser.fullName ?? '',
          username: this.editingUser.username ?? '',
          email: this.editingUser.email ?? '',
          password: '',
          role: this.editingUser.role ?? this.assignableRoles[0] ?? '',
          active: this.editingUser.active,
          gender: this.editingUser.gender ?? 'Prefer not to say'
        }
      : this.createDefaultModel();

    this.submitted = false;
    this.showPassword = false;
    this.userForm?.resetForm(this.model);
  }

  private ensureValidRoleSelection(): void {
    if (this.assignableRoles.length === 0) {
      this.model.role = '';
      return;
    }

    if (!this.assignableRoles.includes(this.model.role)) {
      this.model.role = this.assignableRoles[0];
    }
  }

  private createDefaultModel(): UserFormModel {
    return {
      companyId: '',
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: this.assignableRoles[0] ?? '',
      active: true,
      gender: 'Prefer not to say'
    };
  }

  private shouldShowControlError(control: NgModel): boolean {
    return control.invalid === true && (control.touched === true || control.dirty === true || this.submitted);
  }

  private shouldShowTrimmedRequired(field: TrimmedField, control: NgModel | null): boolean {
    const isInteracted = control
      ? control.touched === true || control.dirty === true || this.submitted
      : this.submitted;

    return isInteracted && this.isWhitespaceOnly(field);
  }

  private isWhitespaceOnly(field: TrimmedField): boolean {
    return this.model[field].length > 0 && this.model[field].trim().length === 0;
  }

  private requiresTrimmedValue(field: keyof UserFormModel): field is TrimmedField {
    return this.trimValidatedFields.includes(field as TrimmedField);
  }

  private hasWhitespaceOnlyErrors(): boolean {
    return this.trimValidatedFields.some((field) => this.isWhitespaceOnly(field));
  }

  private normalizeTrimmedFields(): void {
    this.trimValidatedFields.forEach((field) => this.normalizeField(field));
  }
}
