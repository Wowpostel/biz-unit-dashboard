import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpecItemKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { num } from '../common/util';
import { normalizePartNo } from '../common/part-no';
import { PartImagesService } from './part-images.service';
import {
  CreateSpecDto,
  LookupPartsDto,
  SaveSpecItemsDto,
  SaveTechOperationsDto,
  TechOperationInputDto,
} from './dto';

@Injectable()
export class EngineeringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partImages: PartImagesService,
  ) {}

  listSpecs(tenantId: string) {
    return this.prisma.spec.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async getSpec(tenantId: string, id: string) {
    const spec = await this.prisma.spec.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            operations: {
              orderBy: { seq: 'asc' },
              include: {
                post: true,
                operationType: true,
                images: { select: { id: true, filename: true, mimeType: true } },
              },
            },
            _count: { select: { workItems: true } },
          },
        },
      },
    });
    if (!spec) throw new NotFoundException('Спецификация не найдена');
    const photos = await this.partImages.mapByNumber(tenantId);
    return {
      ...spec,
      items: spec.items.map((item) => ({
        ...item,
        qty: num(item.qty),
        operations: item.operations.map((op) => ({
          ...op,
          timeNormHours: num(op.timeNormHours),
        })),
        hasWork: item._count.workItems > 0,
        photoUrl: photos.get(normalizePartNo(item.designation))?.url ?? null,
      })),
    };
  }

  createSpec(tenantId: string, dto: CreateSpecDto) {
    return this.prisma.spec.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
      },
    });
  }

  async patchSpec(tenantId: string, id: string, dto: CreateSpecDto) {
    await this.getSpec(tenantId, id);
    return this.prisma.spec.update({
      where: { id },
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
      },
    });
  }

  async saveItems(tenantId: string, specId: string, dto: SaveSpecItemsDto) {
    await this.getSpec(tenantId, specId);
    const existing = await this.prisma.specItem.findMany({
      where: { tenantId, specId },
      include: { _count: { select: { workItems: true } } },
    });
    const incomingIds = new Set(
      dto.items.map((i) => i.id).filter((id): id is string => !!id && !id.startsWith('tmp-')),
    );
    for (const row of existing) {
      if (!incomingIds.has(row.id) && row._count.workItems > 0) {
        throw new BadRequestException(
          `Нельзя удалить позицию «${row.designation}»: уже есть детали в работе`,
        );
      }
    }

    const clientToId = new Map<string, string>();
    for (const item of dto.items) {
      if (item.id && !item.id.startsWith('tmp-')) {
        clientToId.set(item.clientId, item.id);
      }
    }

    // First pass: upsert without parents to satisfy FKs, then set parents.
    for (const item of dto.items) {
      const kind = item.kind as SpecItemKind;
      if (item.id && !item.id.startsWith('tmp-')) {
        await this.prisma.specItem.update({
          where: { id: item.id },
          data: {
            designation: item.designation.trim(),
            name: item.name.trim(),
            qty: item.qty,
            unit: item.unit?.trim() || 'шт',
            kind,
            sortOrder: item.sortOrder,
            parentId: null,
          },
        });
        clientToId.set(item.clientId, item.id);
      } else {
        const created = await this.prisma.specItem.create({
          data: {
            tenantId,
            specId,
            designation: item.designation.trim(),
            name: item.name.trim(),
            qty: item.qty,
            unit: item.unit?.trim() || 'шт',
            kind,
            sortOrder: item.sortOrder,
          },
        });
        clientToId.set(item.clientId, created.id);
      }
    }

    for (const item of dto.items) {
      const id = clientToId.get(item.clientId);
      if (!id) continue;
      const parentId = item.parentClientId
        ? clientToId.get(item.parentClientId) ?? null
        : null;
      if (parentId === id) {
        throw new BadRequestException('Позиция не может быть родителем самой себе');
      }
      await this.prisma.specItem.update({
        where: { id },
        data: { parentId },
      });
    }

    const keepIds = [...clientToId.values()];
    await this.prisma.specItem.deleteMany({
      where: { specId, tenantId, id: { notIn: keepIds } },
    });

    for (const item of dto.items) {
      const realId = clientToId.get(item.clientId);
      if (!realId || item.kind === SpecItemKind.MATERIAL) continue;
      if (item.operations) {
        await this.persistOperations(tenantId, realId, item.operations);
      }
    }

    return this.getSpec(tenantId, specId);
  }

  async lookupParts(tenantId: string, dto: LookupPartsDto) {
    const keys = [...new Set(dto.keys.map((k) => k.trim()).filter(Boolean))];
    const result: Record<
      string,
      {
        designation: string;
        name: string;
        operations: {
          seq: number;
          name: string;
          operationTypeId: string | null;
          postId: string | null;
          timeNormHours: number;
          instruction: string;
        }[];
      } | null
    > = {};
    for (const key of keys) result[key] = null;
    if (!keys.length) return result;

    const items = await this.prisma.specItem.findMany({
      where: {
        tenantId,
        kind: { not: SpecItemKind.MATERIAL },
        OR: keys.map((key) => ({
          designation: { equals: key, mode: 'insensitive' as const },
        })),
      },
      include: {
        operations: { orderBy: { seq: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    for (const key of keys) {
      const lower = key.toLowerCase();
      const withTech = items.filter(
        (i) =>
          i.operations.length > 0 &&
          i.designation.toLowerCase() === lower,
      );
      const any = items.filter((i) => i.designation.toLowerCase() === lower);
      const pick = withTech[0] ?? any[0];
      if (!pick) continue;
      result[key] = {
        designation: pick.designation,
        name: pick.name,
        operations: pick.operations.map((op) => ({
          seq: op.seq,
          name: op.name,
          operationTypeId: op.operationTypeId,
          postId: op.postId,
          timeNormHours: num(op.timeNormHours),
          instruction: op.instruction,
        })),
      };
    }
    return result;
  }

  async saveOperations(
    tenantId: string,
    specItemId: string,
    dto: SaveTechOperationsDto,
  ) {
    const item = await this.prisma.specItem.findFirst({
      where: { id: specItemId, tenantId },
    });
    if (!item) throw new NotFoundException('Позиция спецификации не найдена');
    if (item.kind === SpecItemKind.MATERIAL) {
      throw new BadRequestException('На материал технологию не задают');
    }
    await this.persistOperations(tenantId, specItemId, dto.operations);
    return this.getSpec(tenantId, item.specId);
  }

  private async persistOperations(
    tenantId: string,
    specItemId: string,
    operations: TechOperationInputDto[],
  ) {
    const existing = await this.prisma.techOperation.findMany({
      where: { specItemId, tenantId },
    });
    const keep = new Set(
      operations.map((o) => o.id).filter((id): id is string => !!id && !id.startsWith('tmp-')),
    );

    for (const op of operations) {
      const data = {
        seq: op.seq,
        name: op.name.trim(),
        operationTypeId: op.operationTypeId || null,
        postId: op.postId || null,
        timeNormHours: op.timeNormHours,
        instruction: op.instruction?.trim() ?? '',
      };
      if (op.id && !op.id.startsWith('tmp-')) {
        await this.prisma.techOperation.update({
          where: { id: op.id },
          data,
        });
      } else {
        const created = await this.prisma.techOperation.create({
          data: { tenantId, specItemId, ...data },
        });
        keep.add(created.id);
      }
    }

    const toDelete = existing.filter((o) => !keep.has(o.id));
    if (toDelete.length) {
      await this.prisma.techOperation.deleteMany({
        where: { id: { in: toDelete.map((o) => o.id) } },
      });
    }
  }

  async addImage(
    tenantId: string,
    techOperationId: string,
    file: { originalname: string; mimetype: string; path: string },
  ) {
    const op = await this.prisma.techOperation.findFirst({
      where: { id: techOperationId, tenantId },
    });
    if (!op) throw new NotFoundException('Операция не найдена');
    return this.prisma.techImage.create({
      data: {
        tenantId,
        techOperationId,
        filename: file.originalname,
        mimeType: file.mimetype,
        storagePath: file.path,
      },
    });
  }

  async getImage(tenantId: string | undefined, id: string) {
    const img = await this.prisma.techImage.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!img) throw new NotFoundException('Изображение не найдено');
    return img;
  }

  async removeImage(tenantId: string, id: string) {
    const img = await this.getImage(tenantId, id);
    await this.prisma.techImage.delete({ where: { id: img.id } });
    return img;
  }
}
