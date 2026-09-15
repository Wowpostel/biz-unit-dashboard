import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpecItemKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { num } from '../common/util';
import {
  CreateSpecDto,
  SaveSpecItemsDto,
  SaveTechOperationsDto,
} from './dto';

@Injectable()
export class EngineeringService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.getSpec(tenantId, specId);
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

    const existing = await this.prisma.techOperation.findMany({
      where: { specItemId, tenantId },
    });
    const keep = new Set(
      dto.operations.map((o) => o.id).filter((id): id is string => !!id && !id.startsWith('tmp-')),
    );

    for (const op of dto.operations) {
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

    return this.getSpec(tenantId, item.specId);
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
