import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEquipmentDto,
  CreateOperationTypeDto,
  CreatePostDto,
  PatchEquipmentDto,
  PatchPostDto,
} from './dto';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  listPosts(tenantId: string, activeOnly = false) {
    return this.prisma.post.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
      include: { equipment: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  createPost(tenantId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
      },
      include: { equipment: true },
    });
  }

  async patchPost(tenantId: string, id: string, dto: PatchPostDto) {
    const row = await this.prisma.post.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Пост не найден');
    await this.prisma.post.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });
    if (dto.equipmentIds) {
      const unique = [...new Set(dto.equipmentIds.filter(Boolean))];
      for (const eqId of unique) {
        const eq = await this.prisma.equipment.findFirst({ where: { id: eqId, tenantId } });
        if (!eq) throw new BadRequestException('Оборудование не найдено в этом тенанте');
      }
      await this.prisma.equipment.updateMany({
        where: { tenantId, postId: id, id: { notIn: unique } },
        data: { postId: null },
      });
      await this.prisma.equipment.updateMany({
        where: { tenantId, id: { in: unique } },
        data: { postId: id },
      });
    }
    return this.prisma.post.findFirst({
      where: { id },
      include: { equipment: { orderBy: { name: 'asc' } } },
    });
  }

  listEquipment(tenantId: string) {
    return this.prisma.equipment.findMany({
      where: { tenantId },
      include: { post: true },
      orderBy: [{ post: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async createEquipment(tenantId: string, dto: CreateEquipmentDto) {
    if (dto.postId) await this.ensurePost(tenantId, dto.postId);
    return this.prisma.equipment.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        inventoryNo: dto.inventoryNo?.trim() ?? '',
        postId: dto.postId || null,
      },
      include: { post: true },
    });
  }

  async patchEquipment(tenantId: string, id: string, dto: PatchEquipmentDto) {
    const row = await this.prisma.equipment.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Оборудование не найдено');
    if (dto.postId) await this.ensurePost(tenantId, dto.postId);
    return this.prisma.equipment.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        inventoryNo: dto.inventoryNo?.trim(),
        postId: dto.postId === undefined ? undefined : dto.postId || null,
        isActive: dto.isActive,
      },
      include: { post: true },
    });
  }

  listOperationTypes(tenantId: string) {
    return this.prisma.operationType.findMany({
      where: { tenantId },
      include: { defaultPost: true },
      orderBy: { name: 'asc' },
    });
  }

  async createOperationType(tenantId: string, dto: CreateOperationTypeDto) {
    if (dto.defaultPostId) await this.ensurePost(tenantId, dto.defaultPostId);
    return this.prisma.operationType.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        defaultPostId: dto.defaultPostId || null,
      },
      include: { defaultPost: true },
    });
  }

  async removeOperationType(tenantId: string, id: string) {
    const row = await this.prisma.operationType.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Вид операции не найден');
    await this.prisma.operationType.delete({ where: { id } });
    return { ok: true };
  }

  private async ensurePost(tenantId: string, id: string) {
    const row = await this.prisma.post.findFirst({ where: { id, tenantId } });
    if (!row) throw new BadRequestException('Пост не найден');
  }
}
