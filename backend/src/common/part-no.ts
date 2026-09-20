import { extname } from 'path';

export const DEFAULT_PHOTO_BASE_URL = 'https://starksk1.synology.me/web_images/images';

export function normalizePartNo(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export function designationFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
  const primary = base.split(/[_\s]+/)[0] ?? base;
  return normalizePartNo(primary);
}

export function safePartFilename(designation: string, originalName: string): string {
  const ext = (extname(originalName) || '.bin').toLowerCase();
  const stem = normalizePartNo(designation).replace(/[^\w.\-а-яА-ЯёЁ]+/gi, '_');
  return `${stem}${ext}`;
}

export function partImageUrl(id: string): string {
  return `/api/files/part-images/${id}`;
}

export function partByNumberUrl(tenantCode: string, designation: string): string {
  return `/api/files/part-by-number/${encodeURIComponent(tenantCode)}/${encodeURIComponent(normalizePartNo(designation))}`;
}

export function remotePhotoUrl(baseUrl: string | null | undefined, designation: string): string | null {
  const base = (baseUrl ?? DEFAULT_PHOTO_BASE_URL).trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${encodeURIComponent(normalizePartNo(designation))}.png`;
}
