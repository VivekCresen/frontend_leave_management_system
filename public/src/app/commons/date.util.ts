export function formatDate(value: string | number[] | unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  let iso = '';
  if (Array.isArray(value) && value.length >= 3) {
    const [y, m, d] = value as number[];
    iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } else {
    iso = String(value).trim();
  }
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Never';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? 'Never'
    : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatAttendanceDuration(checkIn: string, checkOut: string | null | undefined): string {
  if (!checkOut) return '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toMonthValue(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function toDateString(val: string | number[] | unknown): string {
  if (!val) return '';
  if (Array.isArray(val) && val.length >= 3) {
    const [y, m, d] = val as number[];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return String(val);
}

export function calculateDurationDays(leaveDates: { date: string | number[] | unknown; dayType: string }[]): number {
  return leaveDates.reduce((sum, d) => sum + (d.dayType?.includes('HALF') ? 0.5 : 1.0), 0);
}
