import { AdminLeaveTableRow } from '../dashboard/components/dashboard-leave-table.component';
import { LeaveType } from '../services/leave.service';
import { DashboardStatCard } from '../dashboard/components/dashboard-stat-cards.component';
import { TranslateService } from '../i18n/translate.service';

export function computeLeaveBalanceCards(
  leaveTypes: LeaveType[],
  approvedLeaves: AdminLeaveTableRow[],
  userGender: string,
  translate: TranslateService
): DashboardStatCard[] {
  if (!leaveTypes.length) return [];

  const t = (k: string, fb: string): string => {
    const v = translate.getTranslation(k);
    return v !== k ? v : fb;
  };

  const relevantTypes = leaveTypes.filter((lt) => {
    if (!lt.genderRestriction) return true;
    if (!userGender) return true;
    return lt.genderRestriction.toUpperCase() === userGender.toUpperCase();
  });

  return relevantTypes.map((leaveType) => {
    const takenDays = approvedLeaves
      .filter((l) => l.leaveTypeId === leaveType.id || l.leaveType === leaveType.leaveName)
      .reduce((sum, l) => sum + (l.durationDays ?? 0), 0);

    const remaining = Math.max(0, leaveType.maxDays - takenDays);
    const remainingFmt = Number.isInteger(remaining) ? String(remaining) : remaining.toFixed(1);
    const usedFmt = Number.isInteger(takenDays) ? String(takenDays) : takenDays.toFixed(1);

    const trKey = 'leaveTypes.' + (leaveType.leaveUniqueName || leaveType.leaveName);
    const translatedName =
      translate.getTranslation(trKey) !== trKey ? translate.getTranslation(trKey) : leaveType.leaveName;

    return {
      label: translatedName,
      value: `${remainingFmt} ${t('stats.available', 'available')}`,
      note: `${t('stats.used', 'Used')} ${usedFmt} ${t('stats.of', 'of')} ${leaveType.maxDays} ${t('stats.days', 'days')}`,
      tone: remaining > 0 ? 'teal' : 'orange',
      icon: 'fa-calendar-minus'
    } as DashboardStatCard;
  });
}

export function computeLeaveByType(
  leaves: AdminLeaveTableRow[]
): { type: string; count: number; pct: number }[] {
  const map = new Map<string, number>();
  for (const leave of leaves) {
    map.set(leave.leaveType, (map.get(leave.leaveType) ?? 0) + 1);
  }
  const total = leaves.length || 1;
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}
