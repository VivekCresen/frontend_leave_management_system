import { isPlatformBrowser } from '@angular/common';
import { AdminLeaveTableRow } from '../dashboard/components/dashboard-leave-table.component';

export function persistProgressLeave(
  platformId: object,
  storageKey: string,
  value: AdminLeaveTableRow | null
): void {
  if (!isPlatformBrowser(platformId)) return;
  if (value) {
    localStorage.setItem(storageKey, String(value.id));
  } else {
    localStorage.removeItem(storageKey);
  }
}


export function restoreProgressLeave(
  platformId: object,
  storageKey: string,
  leaves: AdminLeaveTableRow[]
): AdminLeaveTableRow | null {
  if (!isPlatformBrowser(platformId) || !leaves.length) return null;
  const savedId = localStorage.getItem(storageKey);
  if (!savedId) return null;
  return leaves.find((l) => l.id === Number(savedId)) ?? null;
}
