export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 255;
export const STRICT_PASSWORD_PATTERN = '(?=\\S+$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).*';
export const STRICT_PASSWORD_REGEX = new RegExp(`^${STRICT_PASSWORD_PATTERN}$`);
export const STRICT_PASSWORD_MESSAGE =
  'Password must include uppercase, lowercase, number, and special character with no spaces';

export const STRICT_PASSWORD_RULES = [
  '8 to 255 characters',
  'At least one uppercase letter',
  'At least one lowercase letter',
  'At least one number',
  'At least one special character',
  'No spaces'
] as const;

export function getStrictPasswordError(value: string): string | null {
  if (!value) {
    return 'New password is required';
  }

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`;
  }

  if (/\s/.test(value)) {
    return 'Password must not contain spaces';
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }

  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }

  if (!/\d/.test(value)) {
    return 'Password must include at least one number';
  }

  if (!/[^A-Za-z\d]/.test(value)) {
    return 'Password must include at least one special character';
  }

  if (!STRICT_PASSWORD_REGEX.test(value)) {
    return STRICT_PASSWORD_MESSAGE;
  }

  return null;
}
