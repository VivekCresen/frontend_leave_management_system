import { NgModel } from '@angular/forms';

const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;
const PHONE_REGEX = /^[\d\s+\-\(\)]+$/;

export function shouldShowControlError(control: NgModel, submitted: boolean): boolean {
  return control.invalid === true
    && (control.touched === true || control.dirty === true || submitted);
}

export function firstFieldError(fieldErrors: Record<string, string>): string | null {
  const [first] = Object.values(fieldErrors);
  return first ?? null;
}

export function normalizeOtp(value: string, maxLength = 6): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function clearFormMessages(state: {
  errorMessage: string;
  successMessage: string;
  fieldErrors: Record<string, string>;
}): void {
  state.errorMessage = '';
  state.successMessage = '';
  state.fieldErrors = {};
}

export function validateUsername(username: string, minLength = 3, maxLength = 100): string | null {
  if (!username) return null;
  if (username.length < minLength || username.length > maxLength) {
    return `Username must be ${minLength} to ${maxLength} characters`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username must use letters, numbers, dot, underscore, or hyphen only';
  }
  return null;
}

export function validatePhoneNumber(phoneNumber: string): string | null {
  if (!phoneNumber) return null;
  if (!PHONE_REGEX.test(phoneNumber)) {
    return 'Phone number can only contain numbers, spaces, and + - ( )';
  }
  return null;
}
