import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationStatus, Prisma, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionService } from '../production/production.service';
import { PartImagesService } from '../engineering/part-images.service';
import { hoursBetween, num } from '../common/util';
import { ManualTimeDto, StartTimerDto, StopTimerDto } from './dto';

@Injectable()
export class TerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly production: ProductionService,
    private readonly partImages: PartImagesService,
  ) {}

  async scan(tenantId: string, qrCode: string, postId?: string) {
    const raw = qrCode.trim();
    let item;
    try {
      item = await this.production.getWorkItemByQr(tenantId, raw);
    } catch {
      const byNumber = await this.production.findWorkItemsByNumber(tenantId, raw);
      if (byNumber.length === 1) {
        item = byNumber[0];
      } else if (byNumber.length > 1) {
        throw new BadRequestException(
          'Несколько деталей с таким номером — отсканируйте QR или уточните',
        );
      } else {
        throw new NotFoundException('Деталь с таким QR или номером не найдена');
      }
    }
    const current = item.currentOperation;
    return {
      ...item,
      atThisPost: !current || !current.post || !postId ? true : current.post.id === postId,
      otherPostName:
        current?.post && postId && current.post.id !== postId ? current.post.name : null,
    };
  }

  findByNumber(tenantId: string, number: string) {
    return this.production.findWorkItemsByNumber(tenantId, number);
  }

  async queue(tenantId: string, postId: string) {
    const ops = await this.prisma.workOperation.findMany({
      where: {
        tenantId,
        postId,
        status: { in: [OperationStatus.PENDING, OperationStatus.IN_WORK] },
      },
      include: {
        workItem: { include: { specItem: true, order: true } },
        post: true,
        activeOperator: { select: { fullName: true } },
      },
      orderBy: [{ status: 'desc' }, { seq: 'asc' }],
    });
    const photoOf = await this.partImages.resolver(tenantId);
    const ready = [];
    for (const op of ops) {
      if (!(await this.previousDone(op.workItemId, op.seq))) continue;
      ready.push({
        id: op.id,
        seq: op.seq,
        name: op.name,
        status: op.status,
        qrCode: op.workItem.qrCode,
        designation: op.workItem.specItem.designation,
        partName: op.workItem.specItem.name,
        photoUrl: photoOf(op.workItem.specItem.designation),
        orderNumber: op.workItem.order.number,
        postedHours: num(op.postedHours),
        timeNormHours: num(op.timeNormHours),
        activeStartAt: op.activeStartAt,
        operatorName: op.activeOperator?.fullName ?? null,
      });
    }
    return ready;
  }

  async myOpen(tenantId: string, userId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { tenantId, operatorId: userId, stoppedAt: null, mode: 'TIMER' },
      include: {
        post: true,
        workOperation: {
          include: {
            workItem: { include: { specItem: true, order: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
    return entries.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      post: e.post,
      workOperationId: e.workOperationId,
      qrCode: e.workOperation.workItem.qrCode,
      designation: e.workOperation.workItem.specItem.designation,
      name: e.workOperation.name,
      orderNumber: e.workOperation.workItem.order.number,
    }));
  }

  async start(tenantId: string, userId: string, dto: StartTimerDto) {
    const op = await this.prisma.workOperation.findFirst({
      where: { id: dto.workOperationId, tenantId },
      include: { workItem: { include: { operations: true } }, post: true },
    });
    if (!op) throw new NotFoundException('Операция не найдена');
    if (op.status === OperationStatus.DONE) {
      throw new BadRequestException('Операция уже закрыта');
    }
    if (op.postId && op.postId !== dto.postId) {
      throw new BadRequestException(
        `Эта операция на посту «${op.post?.name ?? ''}», выберите его`,
      );
    }
    if (!(await this.previousDone(op.workItemId, op.seq))) {
      throw new BadRequestException('Сначала закройте предыдущую операцию маршрута');
    }
    if (op.activeStartAt && op.activeOperatorId && op.activeOperatorId !== userId) {
      throw new BadRequestException('Таймер уже запущен другим оператором');
    }
    const existing = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId,
        workOperationId: op.id,
        operatorId: userId,
        stoppedAt: null,
        mode: 'TIMER',
      },
    });
    if (existing) {
      throw new BadRequestException('У вас уже есть открытый таймер по этой операции');
    }

    const now = new Date();
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          tenantId,
          workOperationId: op.id,
          operatorId: userId,
          postId: dto.postId,
          mode: 'TIMER',
          startedAt: now,
        },
      });
      await tx.workOperation.update({
        where: { id: op.id },
        data: {
          status: OperationStatus.IN_WORK,
          activeStartAt: now,
          activeOperatorId: userId,
        },
      });
      await tx.workItem.update({
        where: { id: op.workItemId },
        data: { status: WorkItemStatus.IN_WORK },
      });
      return created;
    });
    return entry;
  }

  async stop(tenantId: string, userId: string, dto: StopTimerDto) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: dto.timeEntryId, tenantId, operatorId: userId },
      include: { workOperation: true },
    });
    if (!entry) throw new NotFoundException('Запись времени не найдена');
    if (entry.stoppedAt) {
      throw new BadRequestException('Эта запись уже остановлена');
    }
    const now = new Date();
    const started = entry.startedAt ?? now;
    const hours = Math.max(0, hoursBetween(started, now));

    await this.prisma.$transaction(async (tx) => {
      await tx.timeEntry.update({
        where: { id: entry.id },
        data: {
          stoppedAt: now,
          hours,
          markedComplete: Boolean(dto.complete),
        },
      });
      const posted = num(entry.workOperation.postedHours) + hours;
      await tx.workOperation.update({
        where: { id: entry.workOperationId },
        data: {
          postedHours: posted,
          activeStartAt: null,
          activeOperatorId: null,
          status: dto.complete ? OperationStatus.DONE : OperationStatus.IN_WORK,
        },
      });
      if (dto.complete) {
        await this.closeIfLast(tx, tenantId, entry.workOperation.workItemId);
      }
    });
    return { ok: true, hours, completed: Boolean(dto.complete) };
  }

  async manual(tenantId: string, userId: string, dto: ManualTimeDto) {
    const op = await this.prisma.workOperation.findFirst({
      where: { id: dto.workOperationId, tenantId },
      include: { post: true },
    });
    if (!op) throw new NotFoundException('Операция не найдена');
    if (op.status === OperationStatus.DONE) {
      throw new BadRequestException('Операция уже закрыта');
    }
    if (op.postId && op.postId !== dto.postId) {
      throw new BadRequestException(
        `Эта операция на посту «${op.post?.name ?? ''}»`,
      );
    }
    if (!(await this.previousDone(op.workItemId, op.seq))) {
      throw new BadRequestException('Сначала закройте предыдущую операцию маршрута');
    }
    if (op.activeStartAt) {
      throw new BadRequestException('Сначала остановите открытый таймер');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.timeEntry.create({
        data: {
          tenantId,
          workOperationId: op.id,
          operatorId: userId,
          postId: dto.postId,
          mode: 'MANUAL',
          startedAt: now,
          stoppedAt: now,
          hours: dto.hours,
          markedComplete: Boolean(dto.complete),
        },
      });
      const posted = num(op.postedHours) + dto.hours;
      await tx.workOperation.update({
        where: { id: op.id },
        data: {
          postedHours: posted,
          status: dto.complete ? OperationStatus.DONE : OperationStatus.IN_WORK,
        },
      });
      await tx.workItem.update({
        where: { id: op.workItemId },
        data: { status: WorkItemStatus.IN_WORK },
      });
      if (dto.complete) {
        await this.closeIfLast(tx, tenantId, op.workItemId);
      }
    });
    return { ok: true, hours: dto.hours, completed: Boolean(dto.complete) };
  }

  private async previousDone(workItemId: string, seq: number) {
    const prev = await this.prisma.workOperation.findMany({
      where: { workItemId, seq: { lt: seq }, status: { not: OperationStatus.DONE } },
    });
    return prev.length === 0;
  }

  private async closeIfLast(
    tx: Prisma.TransactionClient,
    tenantId: string,
    workItemId: string,
  ) {
    const leftover = await tx.workOperation.count({
      where: { workItemId, status: { not: OperationStatus.DONE } },
    });
    if (leftover === 0) {
      await tx.workItem.update({
        where: { id: workItemId },
        data: { status: WorkItemStatus.DONE },
      });
      const item = await tx.workItem.findUnique({ where: { id: workItemId } });
      if (!item) return;
      const open = await tx.workItem.count({
        where: { orderId: item.orderId, status: { not: WorkItemStatus.DONE } },
      });
      if (open === 0) {
        await tx.order.update({
          where: { id: item.orderId },
          data: { status: 'DONE' },
        });
      }
    }
    void tenantId;
  }
}
