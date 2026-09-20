import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PHOTO_BASE_URL,
  designationFromFilename,
  normalizePartNo,
  partByNumberUrl,
  partImageUrl,
  remotePhotoUrl,
  safePartFilename,
} from '../common/part-no';

export type UploadedPartFile = {
  originalname: string;
  mimetype: string;
  path: string;
};

@Injectable()
export class PartImagesService {
  constructor(private readonly prisma: PrismaService) {}

  uploadRoot() {
    return process.env.UPLOAD_DIR ?? './uploads';
  }

  inboxDir() {
    const dir = join(this.uploadRoot(), 'parts', 'inbox');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  tenantDir(tenantCode: string) {
    const dir = join(this.uploadRoot(), 'parts', tenantCode);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  async tenantCode(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Площадка не найдена');
    return t.code;
  }

  async tenantOrThrow(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundException('Площадка не найдена');
    return t;
  }

  async settings(tenantId: string) {
    const t = await this.tenantOrThrow(tenantId);
    const base = (t.photoBaseUrl || DEFAULT_PHOTO_BASE_URL).replace(/\/+$/, '');
    return {
      photoBaseUrl: base,
      template: `${base}/{номер}.png`,
    };
  }

  async list(tenantId: string) {
    const rows = await this.prisma.partImage.findMany({
      where: { tenantId },
      orderBy: { designation: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async mapByNumber(tenantId: string) {
    const rows = await this.list(tenantId);
    return new Map(rows.map((r) => [normalizePartNo(r.designation), r]));
  }

  async resolver(tenantId: string) {
    const tenant = await this.tenantOrThrow(tenantId);
    const local = await this.mapByNumber(tenantId);
    const base = (tenant.photoBaseUrl || '').trim();
    return (designation: string): string | null => {
      const n = normalizePartNo(designation);
      if (!n) return null;
      const row = local.get(n);
      if (row && existsSync(row.storagePath)) return row.url;
      if (base) return partByNumberUrl(tenant.code, n);
      return row?.url ?? null;
    };
  }

  async get(tenantId: string | undefined, id: string) {
    const row = await this.prisma.partImage.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundException('Фото детали не найдено');
    return row;
  }

  async attachFiles(tenantId: string, tenantCode: string, files: UploadedPartFile[]) {
    if (!files?.length) {
      throw new BadRequestException('Нет файлов в пачке');
    }
    const out = [];
    for (const file of files) {
      out.push(await this.attachOne(tenantId, tenantCode, file, true));
    }
    return out;
  }

  async ingestInbox(tenantId: string, tenantCode: string) {
    const inbox = this.inboxDir();
    const names = readdirSync(inbox).filter((n) => !n.startsWith('.'));
    const out = [];
    for (const name of names) {
      const src = join(inbox, name);
      out.push(
        await this.attachOne(
          tenantId,
          tenantCode,
          { originalname: name, mimetype: mimeOf(name), path: src },
          false,
        ),
      );
    }
    return { inbox, organized: out.length, items: out };
  }

  async attachOne(
    tenantId: string,
    tenantCode: string,
    file: UploadedPartFile,
    uploaded: boolean,
  ) {
    const designation = designationFromFilename(file.originalname);
    if (!designation) {
      throw new BadRequestException(`Не разобрать номер из имени «${file.originalname}»`);
    }
    const destName = safePartFilename(designation, file.originalname);
    const dest = join(this.tenantDir(tenantCode), destName);
    if (existsSync(file.path) && file.path !== dest) {
      try {
        renameSync(file.path, dest);
      } catch {
        copyFileSync(file.path, dest);
        if (uploaded || file.path.includes(`${join('parts', 'inbox')}`)) {
          try {
            unlinkSync(file.path);
          } catch {
            /* ignore */
          }
        }
      }
    }
    const existing = await this.prisma.partImage.findUnique({
      where: { tenantId_designation: { tenantId, designation } },
    });
    const data = {
      filename: file.originalname,
      mimeType: file.mimetype || mimeOf(file.originalname),
      storagePath: dest,
      publicPath: '',
    };
    const row = existing
      ? await this.prisma.partImage.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.partImage.create({
          data: { tenantId, designation, ...data, publicPath: '' },
        });
    const publicPath = partImageUrl(row.id);
    const saved = await this.prisma.partImage.update({
      where: { id: row.id },
      data: { publicPath },
    });
    return this.serialize(saved);
  }

  async remove(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    await this.prisma.partImage.delete({ where: { id: row.id } });
    return { ok: true };
  }

  serialize(row: {
    id: string;
    designation: string;
    filename: string;
    mimeType: string;
    storagePath: string;
    publicPath: string;
  }) {
    return {
      id: row.id,
      designation: row.designation,
      filename: row.filename,
      mimeType: row.mimeType,
      url: row.publicPath || partImageUrl(row.id),
      storagePath: row.storagePath,
    };
  }

  localFileFor(tenantCode: string, designation: string) {
    const n = normalizePartNo(designation);
    const dir = this.tenantDir(tenantCode);
    const exts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    for (const ext of exts) {
      const path = join(dir, `${n}${ext}`);
      if (existsSync(path)) return { path, mimeType: mimeOf(path) };
    }
    return null;
  }

  async openByNumber(tenantCode: string, designation: string) {
    const n = normalizePartNo(designation);
    if (!n) throw new NotFoundException('Нет номера детали');
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) throw new NotFoundException('Площадка не найдена');

    const row = await this.prisma.partImage.findFirst({
      where: { tenantId: tenant.id, designation: { equals: n, mode: 'insensitive' } },
    });
    if (row && existsSync(row.storagePath)) {
      return { mimeType: row.mimeType, path: row.storagePath, buffer: null };
    }

    const disk = this.localFileFor(tenant.code, n);
    if (disk) return { mimeType: disk.mimeType, path: disk.path, buffer: null };

    const remote = remotePhotoUrl(tenant.photoBaseUrl || DEFAULT_PHOTO_BASE_URL, n);
    if (!remote) throw new NotFoundException('Фото детали не найдено');

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    let resp: Awaited<ReturnType<typeof fetch>>;
    try {
      resp = await fetch(remote, { signal: ac.signal, redirect: 'follow' });
    } catch {
      throw new NotFoundException('Фото детали не найдено');
    } finally {
      clearTimeout(timer);
    }
    const ctype = (resp.headers.get('content-type') || '').split(';')[0].trim();
    if (!resp.ok || !ctype.startsWith('image/')) {
      throw new NotFoundException('Фото детали не найдено');
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const dest = join(this.tenantDir(tenant.code), `${n}.png`);
    try {
      writeFileSync(dest, buf);
    } catch {
      /* cache is optional */
    }
    return {
      mimeType: ctype || 'image/png',
      path: existsSync(dest) ? dest : null,
      buffer: buf,
    };
  }
}

function mimeOf(name: string) {
  const ext = extname(name).toLowerCase();
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}
