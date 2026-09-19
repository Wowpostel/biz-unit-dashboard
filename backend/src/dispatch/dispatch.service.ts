import { Injectable } from '@nestjs/common';
import { OperationStatus, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { num } from '../common/util';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const now = new Date();
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      include: {
        lines: { include: { spec: true } },
        workItems: { include: { operations: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const orderRows = orders.map((order) => {
      const ops = order.workItems.flatMap((w) => w.operations);
      const total = ops.length;
      const done = ops.filter((o) => o.status === OperationStatus.DONE).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const due = order.dueDate.getTime();
      const created = order.createdAt.getTime();
      const span = Math.max(due - created, 1);
      const expected = Math.min(100, Math.max(0, Math.round(((now.getTime() - created) / span) * 100)));
      const overdue = now > order.dueDate && order.status !== 'DONE';
      const lag = pct < expected - 5 || overdue;
      const lagDays = overdue
        ? Math.ceil((now.getTime() - due) / 86400000)
        : 0;
      return {
        id: order.id,
        number: order.number,
        dueDate: order.dueDate,
        status: order.status,
        comment: order.comment,
        specs: order.lines.map((l) => `${l.spec.code} × ${num(l.qty)}`),
        totalOps: total,
        doneOps: done,
        pct,
        expectedPct: expected,
        lag,
        overdue,
        lagDays,
        inWork: order.workItems.filter((w) => w.status !== WorkItemStatus.DONE).length,
        doneItems: order.workItems.filter((w) => w.status === WorkItemStatus.DONE).length,
      };
    });

    const onMachinesRaw = await this.prisma.workOperation.findMany({
      where: {
        tenantId,
        status: { in: [OperationStatus.PENDING, OperationStatus.IN_WORK] },
        workItem: { status: { not: WorkItemStatus.DONE } },
      },
      include: {
        post: true,
        activeOperator: { select: { fullName: true } },
        workItem: { include: { specItem: true, order: true } },
      },
    });

    const byPost = new Map<
      string,
      {
        postId: string | null;
        postName: string;
        items: {
          qrCode: string;
          designation: string;
          name: string;
          operation: string;
          status: OperationStatus;
          orderNumber: string;
          operatorName: string | null;
          activeStartAt: Date | null;
        }[];
      }
    >();
    for (const op of onMachinesRaw) {
      const prevOpen = await this.prisma.workOperation.count({
        where: {
          workItemId: op.workItemId,
          seq: { lt: op.seq },
          status: { not: OperationStatus.DONE },
        },
      });
      if (prevOpen > 0 && op.status === OperationStatus.PENDING) continue;
      const key = op.postId ?? 'none';
      if (!byPost.has(key)) {
        byPost.set(key, {
          postId: op.postId,
          postName: op.post?.name ?? 'Пост не назначен',
          items: [],
        });
      }
      byPost.get(key)!.items.push({
        qrCode: op.workItem.qrCode,
        designation: op.workItem.specItem.designation,
        name: op.workItem.specItem.name,
        operation: op.name,
        status: op.status,
        orderNumber: op.workItem.order.number,
        operatorName: op.activeOperator?.fullName ?? null,
        activeStartAt: op.activeStartAt,
      });
    }

    const overdueItems = await this.prisma.workItem.findMany({
      where: {
        tenantId,
        status: { not: WorkItemStatus.DONE },
        order: { dueDate: { lt: now } },
      },
      include: {
        specItem: true,
        order: true,
        operations: { where: { status: { not: OperationStatus.DONE } }, include: { post: true } },
      },
      orderBy: { order: { dueDate: 'asc' } },
    });

    return {
      generatedAt: now,
      orders: orderRows,
      onMachines: [...byPost.values()],
      overdue: overdueItems.map((w) => {
        const current = w.operations.sort((a, b) => a.seq - b.seq)[0];
        return {
          id: w.id,
          qrCode: w.qrCode,
          designation: w.specItem.designation,
          name: w.specItem.name,
          orderNumber: w.order.number,
          dueDate: w.order.dueDate,
          currentOp: current?.name ?? null,
          postName: current?.post?.name ?? null,
        };
      }),
    };
  }
}
