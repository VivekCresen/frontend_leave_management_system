
export function titleCase(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function toSentenceCase(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDurationDays(value: number): string {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, '');
  return `${normalized} day${value === 1 ? '' : 's'}`;
}

export function getInitials(name: string | null | undefined, fallback = 'U'): string {
  const trimmed = (name ?? '').trim() || fallback;
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || trimmed.slice(0, 2).toUpperCase();
}
