
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}


export function buildUserDirectory(
  users: { username?: string | null; fullName?: string | null }[]
): Record<string, string> {
  const entries = users
    .map(u => [u.username?.trim().toLowerCase(), u.fullName?.trim()] as const)
    .filter((e): e is readonly [string, string] => !!e[0] && !!e[1]);
  return Object.fromEntries(entries);
}


export function extractApiError(
  error: { details?: string[] } | undefined,
  fallback: string
): string {
  return error?.details?.[0] || fallback;
}
