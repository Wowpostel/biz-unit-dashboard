import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationTypeDto, CreatePostDto, PatchPostDto } from './dto';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  listPosts(tenantId: string, activeOnly = false) {
    return this.prisma.post.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
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
    });
  }

  async patchPost(tenantId: string, id: string, dto: PatchPostDto) {
    const row = await this.prisma.post.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Пост не найден');
    return this.prisma.post.update({
      where: { id },
      data: {
        code: dto.code?.trim(),
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  listOperationTypes(tenantId: string) {
    return this.prisma.operationType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  createOperationType(tenantId: string, dto: CreateOperationTypeDto) {
    return this.prisma.operationType.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
      },
    });
  }

  async removeOperationType(tenantId: string, id: string) {
    const row = await this.prisma.operationType.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Вид операции не найден');
    await this.prisma.operationType.delete({ where: { id } });
    return { ok: true };
  }
}
