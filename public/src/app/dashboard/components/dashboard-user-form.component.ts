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
  active: boolean | null;
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
  private readonly companyIdPrefix = 'CRESEN';
  private readonly minimumNextCompanyId = 4;
  private readonly usernameRegex = /^[A-Za-z0-9._-]+$/;

  readonly usernameMinLength = 3;
  readonly usernameMaxLength = 100;
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  readonly passwordRuleText = STRICT_PASSWORD_MESSAGE;
  readonly genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  readonly trimValidatedFields: TrimmedField[] = ['companyId', 'fullName', 'username', 'email'];

  @Input({ required: true }) assignableRoles: string[] = [];
  @Input() users: ManagedUser[] = [];
  @Input() editingUser: ManagedUser | null = null;
  @Input() isSaving = false;
  @Input() fieldErrors: Record<string, string> = {};

  @Output() saveRequested = new EventEmitter<DashboardUserSubmitEvent>();
  @Output() cancelRequested = new EventEmitter<void>();

  @ViewChild('userForm') private userForm?: NgForm;

  submitted = false;
  showPassword = false;
  showServerErrors = true;
  model: UserFormModel = this.createDefaultModel();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingUser']) {
      this.syncModelFromInputs();
      return;
    }

    if (changes['users'] && !this.isEditMode) {
      this.syncGeneratedCompanyId();
    }

    if (changes['assignableRoles']) {
      this.ensureValidRoleSelection();
    }

    if (changes['fieldErrors']) {
      this.showServerErrors = Object.keys(this.fieldErrors).length > 0;
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

  get companyIdHint(): string {
    return this.isEditMode
      ? 'Company ID is locked and cannot be changed.'
      : 'Company ID is assigned automatically and cannot be changed.';
  }

  submit(form: NgForm): void {
    this.submitted = true;
    this.showServerErrors = true;
    this.normalizeTrimmedFields();

    if (form.invalid || this.hasWhitespaceOnlyErrors() || !!this.getPasswordError() || !!this.getUsernameValidationMessage()) {
      return;
    }

    this.saveRequested.emit({
      userId: this.editingUser?.id,
      payload: {
        companyId: this.model.companyId.trim(),
        fullName: this.model.fullName.trim(),
        username: this.model.username.trim(),
        email: this.model.email.trim().toLowerCase(),
        password: this.model.password ? btoa(this.model.password) : '',
        role: this.model.role,
        active: this.model.active ?? true,
        gender: this.model.gender
      }
    });

    this.model.password = '';
    this.showPassword = false;
  }

  cancelEdit(): void {
    this.cancelRequested.emit();
    this.submitted = false;
    this.showPassword = false;
  }

  resetForm(): void {
    this.syncModelFromInputs();
    this.showServerErrors = false;
  }

  getFieldError(field: keyof UserFormModel): string | null {
    if (!this.showServerErrors) {
      return null;
    }

    return this.fieldErrors[field] ?? null;
  }

  getControlError(control: NgModel | null, field: keyof UserFormModel, fallback: string): string | null {
    if (this.getFieldError(field)) {
      return this.getFieldError(field);
    }

    if (this.requiresTrimmedValue(field) && this.shouldShowTrimmedRequired(field, control)) {
      return fallback;
    }

    if (field === 'username' && this.shouldShowFieldFeedback(control)) {
      const usernameError = this.getUsernameValidationMessage();
      if (usernameError) {
        return usernameError;
      }
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
          role: this.editingUser.role ?? '',
          active: this.editingUser.active ?? null,
          gender: this.editingUser.gender ?? ''
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
      this.model.role = '';
    }
  }

  private createDefaultModel(): UserFormModel {
    return {
      companyId: this.generateNextCompanyId(),
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: '',
      active: null,
      gender: ''
    };
  }

  private shouldShowControlError(control: NgModel): boolean {
    return control.invalid === true && this.shouldShowFieldFeedback(control);
  }

  private shouldShowFieldFeedback(control: NgModel | null): boolean {
    return control
      ? control.touched === true || control.dirty === true || this.submitted
      : this.submitted;
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

  private getUsernameValidationMessage(): string | null {
    const username = this.model.username.trim();

    if (!username) {
      return null;
    }

    if (username.length < this.usernameMinLength || username.length > this.usernameMaxLength) {
      return `Username must be ${this.usernameMinLength} to ${this.usernameMaxLength} characters`;
    }

    if (!this.usernameRegex.test(username)) {
      return 'Username must use letters, numbers, dot, underscore, or hyphen only';
    }

    return null;
  }

  private normalizeTrimmedFields(): void {
    this.trimValidatedFields.forEach((field) => this.normalizeField(field));
  }

  private syncGeneratedCompanyId(): void {
    this.model.companyId = this.generateNextCompanyId();
  }

  private generateNextCompanyId(): string {
    const companyIds = this.users
      .map((user) => user.companyId?.trim() ?? '')
      .filter((companyId) => companyId.length > 0);

    const highestCompanyIdNumber = companyIds.reduce((highest, companyId) => {
      const nextValue = this.extractCompanyIdNumber(companyId);
      return nextValue > highest ? nextValue : highest;
    }, this.minimumNextCompanyId - 1);

    let nextValue = Math.max(this.minimumNextCompanyId, this.users.length + 1, highestCompanyIdNumber + 1);
    let candidate = this.formatCompanyId(nextValue);

    while (companyIds.some((companyId) => companyId.toUpperCase() === candidate)) {
      nextValue += 1;
      candidate = this.formatCompanyId(nextValue);
    }

    return candidate;
  }

  private extractCompanyIdNumber(companyId: string): number {
    if (!companyId.toUpperCase().startsWith(this.companyIdPrefix)) {
      return -1;
    }

    const suffix = companyId.slice(this.companyIdPrefix.length);
    return /^\d+$/.test(suffix) ? Number.parseInt(suffix, 10) : -1;
  }

  private formatCompanyId(value: number): string {
    return `${this.companyIdPrefix}${value.toString().padStart(3, '0')}`;
  }
}
