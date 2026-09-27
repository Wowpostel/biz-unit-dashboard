export const SCHEDULE_KINDS = ['WEEKDAYS', 'TWO_TWO', 'CUSTOM'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export function normalizeWeekDays(days?: number[]) {
  if (!days?.length) return [1, 2, 3, 4, 5];
  return [...new Set(days.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
}

export function isoWeekdayUtc(at = new Date()) {
  const d = at.getUTCDay();
  return d === 0 ? 7 : d;
}

export function parseAnchor(raw?: string | null) {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, da));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function onShiftToday(row: {
  isActive: boolean;
  scheduleKind: string;
  weekDays: number[];
  cycleWorkDays: number;
  cycleOffDays: number;
  cycleAnchor: Date | null;
}) {
  if (!row.isActive) return false;
  const kind = row.scheduleKind as ScheduleKind;
  if (kind === 'TWO_TWO') {
    if (!row.cycleAnchor) return null;
    const work = Math.max(1, row.cycleWorkDays || 2);
    const off = Math.max(1, row.cycleOffDays || 2);
    const cycle = work + off;
    const start = Date.UTC(
      row.cycleAnchor.getUTCFullYear(),
      row.cycleAnchor.getUTCMonth(),
      row.cycleAnchor.getUTCDate(),
    );
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diff = Math.floor((today - start) / 86400000);
    const pos = ((diff % cycle) + cycle) % cycle;
    return pos < work;
  }
  const days = row.weekDays?.length ? row.weekDays : [1, 2, 3, 4, 5];
  return days.includes(isoWeekdayUtc());
}

export function scheduleLabel(row: {
  scheduleKind: string;
  weekDays: number[];
  shiftStart: string;
  shiftEnd: string;
  cycleWorkDays: number;
  cycleOffDays: number;
}) {
  const hours = `${row.shiftStart}–${row.shiftEnd}`;
  if (row.scheduleKind === 'TWO_TWO') {
    return `${row.cycleWorkDays}/${row.cycleOffDays}, ${hours}`;
  }
  const names = ['', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const days = (row.weekDays?.length ? row.weekDays : [1, 2, 3, 4, 5])
    .map((d) => names[d] ?? String(d))
    .join(', ');
  if (row.scheduleKind === 'WEEKDAYS') return `Пн–пт, ${hours}`;
  return `${days}, ${hours}`;
}
