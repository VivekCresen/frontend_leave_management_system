export type DayType = string;

export function sessionLabel(dayType: DayType): string {
  if (dayType === 'MORNING_HALF') return 'Morning';
  if (dayType === 'AFTERNOON_HALF') return 'Afternoon';
  return 'Full day';
}

export function sessionColor(dayType: DayType): string {
  if (dayType === 'MORNING_HALF') return '#0369a1';
  if (dayType === 'AFTERNOON_HALF') return '#7c3aed';
  return '#0f766e';
}

export function sessionIcon(dayType: DayType): string {
  if (dayType === 'MORNING_HALF') return '🌅';
  if (dayType === 'AFTERNOON_HALF') return '🌇';
  return '📅';
}

export function buildDatesCellHtml(
  dates: { date: string; dayType: string }[],
  leaveId: number,
  fmtDate: (v: string) => string,
  esc: (v: string | null | undefined) => string
): string {
  if (dates.length === 0) return '<span style="color:#94a3b8;">—</span>';

  const total = dates.reduce((s, d) => s + (d.dayType?.includes('HALF') ? 0.5 : 1.0), 0);
  const totalFmt = Number.isInteger(total) ? `${total}` : total.toFixed(1);
  const first = dates[0];
  const extra = dates.length - 1;
  const color = sessionColor(first.dayType ?? '');
  const badge = `<span style="color:${color};font-size:0.7rem;font-weight:700;background:${color}18;padding:1px 5px;border-radius:4px;margin-left:4px;">${sessionLabel(first.dayType ?? '')}</span>`;
  const moreLink = extra > 0
    ? `<br><button data-action="show-dates" data-leave-id="${leaveId}" style="background:none;border:none;padding:0;cursor:pointer;color:#0f8b8d;font-size:0.76rem;font-weight:700;text-decoration:underline;text-underline-offset:2px;line-height:1.8;">+${extra} more date${extra !== 1 ? 's' : ''}</button>`
    : '';
  const summary = `<br><span style="color:#94a3b8;font-size:0.7rem;">${dates.length} date${dates.length !== 1 ? 's' : ''} · ${totalFmt} day${total !== 1 ? 's' : ''}</span>`;
  return `<span style="font-size:0.82rem;font-weight:700;color:#0f172a;">${sessionIcon(first.dayType ?? '')} ${fmtDate(first.date)}</span>${badge}${moreLink}${summary}`;
}

const STATUS_ICONS: Record<string, string> = {
  pending: 'fa-clock',
  'manager-approved': 'fa-hourglass-half',
  approved: 'fa-circle-check',
  rejected: 'fa-circle-xmark'
};


export function buildStatusBadgeHtml(rawStatus: string, label: string): string {
  const cls = rawStatus === 'MANAGER_APPROVED' ? 'manager-approved' : rawStatus.toLowerCase();
  const icon = STATUS_ICONS[cls] ?? 'fa-circle';
  return `<span class="ag-status-badge ag-status-${cls}"><i class="fas ${icon}"></i> ${label}</span>`;
}
