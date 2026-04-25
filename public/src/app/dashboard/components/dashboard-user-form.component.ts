import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, HostListener } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { ManagedUser, UserManagementPayload, CountryOption, PhoneCodeOption } from '../../services/auth.service';
import { injectAuthService } from '../../services/auth.service';
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
  managerUsername: string;
  active: boolean | null;
  gender: string;
  countryId: number | null;
  phoneCodeId: number | null;
  phoneNumber: string;
};

type TrimmedField = 'companyId' | 'fullName' | 'username' | 'email' | 'phoneNumber';

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
export class DashboardUserFormComponent implements OnChanges, OnInit {
  private readonly companyIdPrefix = 'CRESEN';
  private readonly minimumNextCompanyId = 4;
  private readonly usernameRegex = /^[A-Za-z0-9._-]+$/;
  private readonly authService = injectAuthService();

  readonly usernameMinLength = 3;
  readonly usernameMaxLength = 100;
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  readonly passwordRuleText = STRICT_PASSWORD_MESSAGE;
  readonly genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  readonly trimValidatedFields: TrimmedField[] = ['companyId', 'fullName', 'username', 'email', 'phoneNumber'];

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
  countries: CountryOption[] = [];
  phoneCodes: PhoneCodeOption[] = [];
  isLoading = false;

  isCountryDropdownOpen = false;
  countrySearchText = '';

  isPhoneCodeDropdownOpen = false;
  phoneCodeSearchText = '';

  get searchedCountries(): CountryOption[] {
    const term = this.countrySearchText.toLowerCase().trim();
    if (!term) return this.countries;
    return this.countries.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.code.toLowerCase().includes(term)
    );
  }

  get searchedPhoneCodes(): PhoneCodeOption[] {
    const term = this.phoneCodeSearchText.toLowerCase().trim();
    const codes = this.filteredPhoneCodes;
    if (!term) return codes;
    return codes.filter(c => 
      c.countryName.toLowerCase().includes(term) || 
      c.dialCode.toLowerCase().includes(term) ||
      (c.flagEmoji && c.flagEmoji.includes(term))
    );
  }

  toggleCountryDropdown(event: Event): void {
    event.stopPropagation();
    if (this.isLoading) return;
    this.isCountryDropdownOpen = !this.isCountryDropdownOpen;
    this.isPhoneCodeDropdownOpen = false;
    if (this.isCountryDropdownOpen) {
      this.countrySearchText = '';
    }
  }

  togglePhoneCodeDropdown(event: Event): void {
    event.stopPropagation();
    if (this.isLoading) return;
    this.isPhoneCodeDropdownOpen = !this.isPhoneCodeDropdownOpen;
    this.isCountryDropdownOpen = false;
    if (this.isPhoneCodeDropdownOpen) {
      this.phoneCodeSearchText = '';
    }
  }

  selectCountry(countryId: number | null): void {
    this.model.countryId = countryId;
    this.isCountryDropdownOpen = false;
    this.onCountryChange();
  }

  selectPhoneCode(phoneCodeId: number | null): void {
    this.model.phoneCodeId = phoneCodeId;
    this.isPhoneCodeDropdownOpen = false;
  }

  getSelectedCountryLabel(): string {
    const c = this.countries.find(x => x.id === this.model.countryId);
    return c ? `${c.flagEmoji} ${c.name}` : 'Select country (optional)';
  }

  getSelectedPhoneCodeLabel(): string {
    const p = this.phoneCodes.find(x => x.id === this.model.phoneCodeId);
    return p ? `${p.flagEmoji} ${p.countryName} (+${p.dialCode})` : 'Select phone code (optional)';
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.isCountryDropdownOpen = false;
    this.isPhoneCodeDropdownOpen = false;
  }

  ngOnInit(): void {
    this.loadCountriesAndPhoneCodes();
  }

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

  get managerOptions(): ManagedUser[] {
    return this.users
      .filter((user) => user.role === 'MANAGER' && user.active)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  get shouldShowManagerField(): boolean {
    return this.assignableRoles.includes('MANAGER') && this.model.role === 'EMPLOYEE';
  }

  submit(form: NgForm): void {
    this.submitted = true;
    this.showServerErrors = true;
    this.normalizeTrimmedFields();

    if (
      form.invalid
      || this.hasWhitespaceOnlyErrors()
      || !!this.getPasswordError()
      || !!this.getUsernameValidationMessage()
      || !!this.getManagerError()
      || !!this.getPhoneNumberValidationMessage()
      || (!!this.model.phoneNumber?.trim() && !this.model.phoneCodeId)
    ) {
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
        managerUsername: this.shouldShowManagerField ? (this.model.managerUsername.trim() || undefined) : undefined,
        active: this.model.active ?? true,
        gender: this.model.gender,
        countryId: this.model.countryId,
        phoneCodeId: this.model.phoneCodeId,
        phoneNumber: this.model.phoneNumber ? this.model.phoneNumber.trim() : null
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

    if (field === 'phoneNumber' && this.shouldShowFieldFeedback(control)) {
      const phoneError = this.getPhoneNumberValidationMessage();
      if (phoneError) {
        return phoneError;
      }
    }

    if (field === 'phoneCodeId' && this.shouldShowFieldFeedback(control)) {
      if (this.model.phoneNumber?.trim() && !this.model.phoneCodeId) {
        return 'Phone code is required when phone number is provided';
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

  getManagerError(): string | null {
    if (!this.shouldShowManagerField) {
      return null;
    }

    if (this.getFieldError('managerUsername')) {
      return this.getFieldError('managerUsername');
    }

    if (!this.isEditMode && this.submitted && !this.model.managerUsername.trim()) {
      return 'Manager is required';
    }

    return null;
  }

  normalizeField(field: TrimmedField): void {
    this.model[field] = this.model[field].trim();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onCountryChange(): void {
    if (this.model.countryId) {
      const defaultPhoneCode = this.phoneCodes.find((pc) => pc.countryId === this.model.countryId);
      if (defaultPhoneCode) {
        this.model.phoneCodeId = defaultPhoneCode.id;
      } else {
        this.model.phoneCodeId = null;
      }
    } else {
      this.model.phoneCodeId = null;
    }
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
          managerUsername: this.editingUser.createdBy ?? '',
          active: this.editingUser.active ?? null,
          gender: this.editingUser.gender ?? '',
          countryId: this.editingUser.countryId ?? null,
          phoneCodeId: this.editingUser.phoneCodeId ?? null,
          phoneNumber: this.editingUser.phoneNumber ?? ''
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

    if (!this.shouldShowManagerField) {
      this.model.managerUsername = '';
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
      managerUsername: '',
      active: null,
      gender: '',
      countryId: null,
      phoneCodeId: null,
      phoneNumber: ''
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

  private getPhoneNumberValidationMessage(): string | null {
    const phoneNumber = this.model.phoneNumber?.trim();
    if (!phoneNumber) return null;

    if (!/^[\d\s+\-\(\)]+$/.test(phoneNumber)) {
      return 'Phone number can only contain numbers, spaces, and + - ( )';
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

  private loadCountriesAndPhoneCodes(): void {
    this.isLoading = true;
    let requestsPending = 2;
    const checkComplete = () => {
      requestsPending--;
      if (requestsPending === 0) {
        this.isLoading = false;
      }
    };

    this.authService.getCountries().subscribe({
      next: (countries) => {
        this.countries = countries;
        checkComplete();
      },
      error: () => {
        console.error('Failed to load countries');
        checkComplete();
      }
    });

    this.authService.getPhoneCodes().subscribe({
      next: (phoneCodes) => {
        this.phoneCodes = phoneCodes;
        checkComplete();
      },
      error: () => {
        console.error('Failed to load phone codes');
        checkComplete();
      }
    });
  }

  get filteredPhoneCodes(): PhoneCodeOption[] {
    if (!this.model.countryId) {
      return this.phoneCodes;
    }
    return this.phoneCodes.filter(pc => pc.countryId === this.model.countryId);
  }
}
