import { extname } from 'path';

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
