export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 100;
export const PRIORITY_DEFAULT = 50;

export function clampPriority(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return PRIORITY_DEFAULT;
  return Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, Math.round(Number(value))));
}
