export function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

export function hoursBetween(start: Date, end: Date): number {
  return Math.round(((end.getTime() - start.getTime()) / 36e5) * 1000) / 1000;
}

export function makeQrCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'E';
  for (let i = 0; i < 9; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
