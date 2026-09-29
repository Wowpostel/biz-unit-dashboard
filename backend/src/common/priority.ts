export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 100;
export const PRIORITY_DEFAULT = 50;

export function clampPriority(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return PRIORITY_DEFAULT;
  return Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, Math.round(Number(value))));
}

export function compareQueueRow(
  a: { inWork: boolean; priority: number; itemPriority?: number; dueAt: number; createdAt: number },
  b: { inWork: boolean; priority: number; itemPriority?: number; dueAt: number; createdAt: number },
) {
  if (a.inWork !== b.inWork) return a.inWork ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ai = a.itemPriority ?? 50;
  const bi = b.itemPriority ?? 50;
  if (ai !== bi) return bi - ai;
  if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
  return a.createdAt - b.createdAt;
}
