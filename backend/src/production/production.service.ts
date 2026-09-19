import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OperationStatus, Prisma, SpecItemKind, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { makeQrCode, num } from '../common/util';
import { normalizePartNo, partImageUrl } from '../common/part-no';
import { CreateOrderDto, LaunchDto } from './dto';

type ItemRow = {
  id: string;
  parentId: string | null;
  qty: Prisma.Decimal | number;
  kind: SpecItemKind;
  designation: string;
  operations: {
    id: string;
    seq: number;
    name: string;
    postId: string | null;
    timeNormHours: Prisma.Decimal | number;
    instruction: string;
  }[];
};

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { dueDate: 'asc' },
      include: {
        lines: { include: { spec: true } },
        _count: { select: { workItems: true, launches: true } },
      },
    });
    const stats = await this.orderStats(tenantId, orders.map((o) => o.id));
    return orders.map((o) => ({
      ...o,
      lines: o.lines.map((l) => ({ ...l, qty: num(l.qty) })),
      progress: stats.get(o.id) ?? { total: 0, done: 0, pct: 0 },
    }));
  }

  async getOrder(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        lines: { include: { spec: true } },
        launches: {
          orderBy: { launchedAt: 'desc' },
          include: {
            spec: true,
            launchedBy: { select: { fullName: true } },
            _count: { select: { workItems: true } },
          },
        },
        workItems: {
          include: {
            specItem: true,
            operations: { include: { post: true }, orderBy: { seq: 'asc' } },
          },
          orderBy: [{ specItem: { designation: 'asc' } }, { pieceIndex: 'asc' }],
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const photos = await this.partPhotos(tenantId);
    return {
      ...order,
      lines: order.lines.map((l) => ({ ...l, qty: num(l.qty) })),
      workItems: order.workItems.map((w) =>
        this.serializeWorkItem(w, false, photos.get(normalizePartNo(w.specItem.designation)) ?? null),
      ),
    };
  }

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    if (!dto.lines.length) {
      throw new BadRequestException('В заказе нужна хотя бы одна спецификация');
    }
    for (const line of dto.lines) {
      const spec = await this.prisma.spec.findFirst({
        where: { id: line.specId, tenantId },
      });
      if (!spec) throw new BadRequestException('Спецификация не найдена');
    }
    return this.prisma.order.create({
      data: {
        tenantId,
        number: dto.number.trim(),
        dueDate: new Date(dto.dueDate),
        comment: dto.comment?.trim() ?? '',
        lines: {
          create: dto.lines.map((l) => ({
            tenantId,
            specId: l.specId,
            qty: l.qty,
          })),
        },
      },
      include: { lines: { include: { spec: true } } },
    });
  }

  async launch(tenantId: string, userId: string, orderId: string, dto: LaunchDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const line = order.lines.find((l) => l.specId === dto.specId);
    if (!line) {
      throw new BadRequestException('Этой спецификации нет в заказе');
    }

    const spec = await this.prisma.spec.findFirst({
      where: { id: dto.specId, tenantId },
      include: {
        items: {
          include: { operations: { orderBy: { seq: 'asc' } } },
        },
      },
    });
    if (!spec) throw new NotFoundException('Спецификация не найдена');

    const items = spec.items as ItemRow[];
    const byId = new Map(items.map((i) => [i.id, i]));
    const pathQty = (item: ItemRow): number => {
      let q = num(item.qty);
      let cur: ItemRow | undefined = item;
      while (cur?.parentId) {
        const parent = byId.get(cur.parentId);
        if (!parent) break;
        q *= num(parent.qty);
        cur = parent;
      }
      return q;
    };

    const plan = new Map<string, { item: ItemRow; count: number }>();
    for (const item of items) {
      if (item.kind === SpecItemKind.MATERIAL) continue;
      if (!item.operations.length) continue;
      const count = Math.max(1, Math.round(dto.qty * pathQty(item)));
      plan.set(item.id, { item, count });
    }
    for (const extra of dto.extraPieces ?? []) {
      const item = byId.get(extra.specItemId);
      if (!item) throw new BadRequestException('Позиция для поштучного запуска не найдена');
      if (item.kind === SpecItemKind.MATERIAL) {
        throw new BadRequestException('Материал в работу не запускают');
      }
      if (!item.operations.length) {
        throw new BadRequestException(`У «${item.designation}» нет технологии`);
      }
      const cur = plan.get(item.id);
      if (cur) cur.count += extra.count;
      else plan.set(item.id, { item, count: extra.count });
    }
    if (!plan.size) {
      throw new BadRequestException(
        'Нечего запускать: нет позиций с технологией. Задайте операции на деталях и сборках.',
      );
    }

    const launch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.launch.create({
        data: {
          tenantId,
          orderId,
          specId: dto.specId,
          qty: dto.qty,
          launchedById: userId,
          comment: dto.comment?.trim() ?? '',
        },
      });

      for (const { item, count } of plan.values()) {
        const last = await tx.workItem.findFirst({
          where: { tenantId, specItemId: item.id, orderId },
          orderBy: { pieceIndex: 'desc' },
        });
        let index = last?.pieceIndex ?? 0;
        for (let n = 0; n < count; n += 1) {
          index += 1;
          let qr = makeQrCode();
          // collision retry
          for (let t = 0; t < 5; t += 1) {
            const clash = await tx.workItem.findUnique({ where: { qrCode: qr } });
            if (!clash) break;
            qr = makeQrCode();
          }
          const workItem = await tx.workItem.create({
            data: {
              tenantId,
              launchId: created.id,
              orderId,
              specItemId: item.id,
              qrCode: qr,
              pieceIndex: index,
              qty: 1,
              isPiece: true,
              status: WorkItemStatus.QUEUED,
            },
          });
          for (const op of item.operations) {
            await tx.workOperation.create({
              data: {
                tenantId,
                workItemId: workItem.id,
                techOperationId: op.id,
                seq: op.seq,
                name: op.name,
                postId: op.postId,
                timeNormHours: op.timeNormHours,
                instruction: op.instruction,
                status: OperationStatus.PENDING,
              },
            });
          }
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'IN_PROGRESS' },
      });
      return created;
    });

    return this.getLaunch(tenantId, launch.id);
  }

  async getLaunch(tenantId: string, id: string) {
    const launch = await this.prisma.launch.findFirst({
      where: { id, tenantId },
      include: {
        spec: true,
        order: true,
        launchedBy: { select: { fullName: true } },
        workItems: {
          include: {
            specItem: true,
            operations: { include: { post: true }, orderBy: { seq: 'asc' } },
          },
          orderBy: [{ specItem: { designation: 'asc' } }, { pieceIndex: 'asc' }],
        },
      },
    });
    if (!launch) throw new NotFoundException('Запуск не найден');
    const photos = await this.partPhotos(tenantId);
    return {
      ...launch,
      workItems: launch.workItems.map((w) =>
        this.serializeWorkItem(w, false, photos.get(normalizePartNo(w.specItem.designation)) ?? null),
      ),
    };
  }

  async getWorkItemByQr(tenantId: string, qrCode: string) {
    const item = await this.prisma.workItem.findFirst({
      where: { tenantId, qrCode: qrCode.trim().toUpperCase() },
      include: {
        specItem: { include: { spec: true } },
        order: true,
        launch: { include: { spec: true } },
        operations: {
          include: {
            post: true,
            techOperation: {
              include: { images: true, operationType: true },
            },
            activeOperator: { select: { fullName: true } },
          },
          orderBy: { seq: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Деталь с таким QR не найдена');
    const photos = await this.partPhotos(tenantId);
    return this.serializeWorkItem(
      item,
      true,
      photos.get(normalizePartNo(item.specItem.designation)) ?? null,
    );
  }

  async findWorkItemsByNumber(tenantId: string, number: string) {
    const q = number.trim();
    if (!q) throw new BadRequestException('Укажите номер детали');
    const items = await this.prisma.workItem.findMany({
      where: {
        tenantId,
        specItem: { designation: { contains: q, mode: 'insensitive' } },
      },
      include: {
        specItem: { include: { spec: true } },
        order: true,
        launch: { include: { spec: true } },
        operations: {
          include: {
            post: true,
            techOperation: { include: { images: true, operationType: true } },
            activeOperator: { select: { fullName: true } },
          },
          orderBy: { seq: 'asc' },
        },
      },
      orderBy: [{ specItem: { designation: 'asc' } }, { pieceIndex: 'asc' }],
      take: 30,
    });
    const photos = await this.partPhotos(tenantId);
    return items.map((item) =>
      this.serializeWorkItem(
        item,
        true,
        photos.get(normalizePartNo(item.specItem.designation)) ?? null,
      ),
    );
  }

  private async partPhotos(tenantId: string) {
    const rows = await this.prisma.partImage.findMany({ where: { tenantId } });
    return new Map(
      rows.map((r) => [normalizePartNo(r.designation), r.publicPath || partImageUrl(r.id)]),
    );
  }

  private async orderStats(tenantId: string, orderIds: string[]) {
    const map = new Map<string, { total: number; done: number; pct: number }>();
    if (!orderIds.length) return map;
    const ops = await this.prisma.workOperation.findMany({
      where: { tenantId, workItem: { orderId: { in: orderIds } } },
      select: { status: true, workItem: { select: { orderId: true } } },
    });
    for (const id of orderIds) map.set(id, { total: 0, done: 0, pct: 0 });
    for (const op of ops) {
      const row = map.get(op.workItem.orderId);
      if (!row) continue;
      row.total += 1;
      if (op.status === OperationStatus.DONE) row.done += 1;
    }
    for (const row of map.values()) {
      row.pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
    }
    return map;
  }

  serializeWorkItem(
    item: {
      id: string;
      qrCode: string;
      pieceIndex: number;
      qty: Prisma.Decimal | number;
      isPiece: boolean;
      status: WorkItemStatus;
      specItem: {
        designation: string;
        name: string;
        kind: SpecItemKind;
        spec?: { code: string; name: string };
      };
      order?: { number: string; dueDate: Date };
      launch?: { qty: number; spec?: { code: string; name: string } };
      operations: {
        id: string;
        seq: number;
        name: string;
        status: OperationStatus;
        postId: string | null;
        timeNormHours: Prisma.Decimal | number;
        instruction: string;
        postedHours: Prisma.Decimal | number;
        activeStartAt: Date | null;
        activeOperator?: { fullName: string } | null;
        post?: { id: string; code: string; name: string } | null;
        techOperation?: {
          images: { id: string; filename: string }[];
          operationType?: { name: string } | null;
        } | null;
      }[];
    },
    withTech = false,
    photoUrl: string | null = null,
  ) {
    const ops = [...item.operations].sort((a, b) => a.seq - b.seq);
    const current = ops.find((o) => o.status !== OperationStatus.DONE) ?? null;
    return {
      id: item.id,
      qrCode: item.qrCode,
      pieceIndex: item.pieceIndex,
      qty: num(item.qty),
      isPiece: item.isPiece,
      status: item.status,
      designation: item.specItem.designation,
      name: item.specItem.name,
      photoUrl,
      kind: item.specItem.kind,
      specCode: item.specItem.spec?.code ?? item.launch?.spec?.code ?? '',
      specName: item.specItem.spec?.name ?? item.launch?.spec?.name ?? '',
      orderNumber: item.order?.number ?? '',
      dueDate: item.order?.dueDate ?? null,
      currentOperation: current
        ? {
            id: current.id,
            seq: current.seq,
            name: current.name,
            status: current.status,
            post: current.post
              ? { id: current.post.id, code: current.post.code, name: current.post.name }
              : null,
            timeNormHours: num(current.timeNormHours),
            postedHours: num(current.postedHours),
            instruction: withTech ? current.instruction : undefined,
            images: withTech
              ? (current.techOperation?.images ?? []).map((i) => ({
                  id: i.id,
                  filename: i.filename,
                  url: `/api/files/tech-images/${i.id}`,
                }))
              : undefined,
            activeStartAt: current.activeStartAt,
            operatorName: current.activeOperator?.fullName ?? null,
            typeName: current.techOperation?.operationType?.name ?? null,
          }
        : null,
      operations: ops.map((o) => ({
        id: o.id,
        seq: o.seq,
        name: o.name,
        status: o.status,
        post: o.post ? { id: o.post.id, code: o.post.code, name: o.post.name } : null,
        timeNormHours: num(o.timeNormHours),
        postedHours: num(o.postedHours),
        instruction: withTech ? o.instruction : undefined,
        images: withTech
          ? (o.techOperation?.images ?? []).map((i) => ({
              id: i.id,
              filename: i.filename,
              url: `/api/files/tech-images/${i.id}`,
            }))
          : undefined,
        activeStartAt: o.activeStartAt,
        operatorName: o.activeOperator?.fullName ?? null,
      })),
    };
  }
}
