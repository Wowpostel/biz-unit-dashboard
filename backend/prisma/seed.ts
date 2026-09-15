import {
  OperationStatus,
  PrismaClient,
  Role,
  SpecItemKind,
  WorkItemStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

function qr() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'E';
  for (let i = 0; i < 9; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const prisma = new PrismaClient();

async function ensureEquipment(
  tenantId: string,
  posts: { tok: { id: string }; frez: { id: string }; sbor: { id: string } },
) {
  const count = await prisma.equipment.count({ where: { tenantId } });
  if (count > 0) return;
  await prisma.equipment.createMany({
    data: [
      { tenantId, code: '16К20-1', name: 'Токарный 16К20 №1', inventoryNo: 'ИН-101', postId: posts.tok.id },
      { tenantId, code: '16К20-2', name: 'Токарный 16К20 №2', inventoryNo: 'ИН-102', postId: posts.tok.id },
      { tenantId, code: '1К62-1', name: 'Токарный 1К62', inventoryNo: 'ИН-103', postId: posts.tok.id },
      { tenantId, code: '6Р13-1', name: 'Фрезерный 6Р13 №1', inventoryNo: 'ИН-201', postId: posts.frez.id },
      { tenantId, code: '6Р13-2', name: 'Фрезерный 6Р13 №2', inventoryNo: 'ИН-202', postId: posts.frez.id },
      { tenantId, code: 'СБОР-1', name: 'Сборочный стол №1', inventoryNo: 'ИН-301', postId: posts.sbor.id },
      { tenantId, code: 'СБОР-2', name: 'Сборочный стол №2', inventoryNo: 'ИН-302', postId: posts.sbor.id },
    ],
  });
}

async function main() {
  const existing = await prisma.tenant.findUnique({ where: { code: 'pilot' } });
  if (existing) {
    const posts = await prisma.post.findMany({ where: { tenantId: existing.id } });
    const byCode = Object.fromEntries(posts.map((p) => [p.code, p]));
    if (byCode['ТОКАР'] && byCode['ФРЕЗ'] && byCode['СБОР']) {
      await ensureEquipment(existing.id, {
        tok: byCode['ТОКАР'],
        frez: byCode['ФРЕЗ'],
        sbor: byCode['СБОР'],
      });
      await prisma.operationType.updateMany({
        where: { tenantId: existing.id, code: 'ТОК' },
        data: { defaultPostId: byCode['ТОКАР'].id },
      });
      await prisma.operationType.updateMany({
        where: { tenantId: existing.id, code: 'ФРЗ' },
        data: { defaultPostId: byCode['ФРЕЗ'].id },
      });
      await prisma.operationType.updateMany({
        where: { tenantId: existing.id, code: { in: ['СБР', 'КТР'] } },
        data: { defaultPostId: byCode['СБОР'].id },
      });
    }
    console.log('Пилот уже заполнен, дописали оборудование при необходимости.');
    return;
  }

  const tenant = await prisma.tenant.create({
    data: { code: 'pilot', name: 'Пилотный завод' },
  });

  const posts = {
    tok: await prisma.post.create({
      data: {
        tenantId: tenant.id,
        code: 'ТОКАР',
        name: 'Токарный участок',
        description: 'Токарные станки',
      },
    }),
    frez: await prisma.post.create({
      data: {
        tenantId: tenant.id,
        code: 'ФРЕЗ',
        name: 'Фрезерный участок',
        description: 'Фрезерные станки',
      },
    }),
    sbor: await prisma.post.create({
      data: {
        tenantId: tenant.id,
        code: 'СБОР',
        name: 'Сборочный пост',
        description: 'Сборка и контроль',
      },
    }),
  };

  const types = {
    tok: await prisma.operationType.create({
      data: { tenantId: tenant.id, code: 'ТОК', name: 'Токарная', defaultPostId: posts.tok.id },
    }),
    frez: await prisma.operationType.create({
      data: { tenantId: tenant.id, code: 'ФРЗ', name: 'Фрезерная', defaultPostId: posts.frez.id },
    }),
    sbor: await prisma.operationType.create({
      data: { tenantId: tenant.id, code: 'СБР', name: 'Сборка', defaultPostId: posts.sbor.id },
    }),
    ctrl: await prisma.operationType.create({
      data: { tenantId: tenant.id, code: 'КТР', name: 'Контроль', defaultPostId: posts.sbor.id },
    }),
  };

  await ensureEquipment(tenant.id, posts);

  const ivanov = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Иванов Сергей Петрович',
      personnelNo: 'Т-014',
      defaultPostId: posts.tok.id,
    },
  });
  await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Петрова Анна Игоревна',
      personnelNo: 'Ф-008',
      defaultPostId: posts.frez.id,
    },
  });
  await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Сидоров Павел Алексеевич',
      personnelNo: 'С-003',
      defaultPostId: posts.sbor.id,
    },
  });

  const hash = async (p: string) => bcrypt.hash(p, 10);

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@erpevv.local',
      passwordHash: await hash('Admin123!'),
      fullName: 'Администратор площадки',
      role: Role.ADMIN,
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'tech@erpevv.local',
      passwordHash: await hash('Tech123!'),
      fullName: 'Елена Технолог',
      role: Role.TECHNOLOGIST,
    },
  });
  const dispatcher = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'disp@erpevv.local',
      passwordHash: await hash('Disp123!'),
      fullName: 'Дмитрий Диспетчер',
      role: Role.DISPATCHER,
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'oper@erpevv.local',
      passwordHash: await hash('Oper123!'),
      fullName: 'Иванов Сергей Петрович',
      role: Role.OPERATOR,
      employeeId: ivanov.id,
    },
  });

  const spec = await prisma.spec.create({
    data: {
      tenantId: tenant.id,
      code: 'РЦ-12',
      name: 'Редуктор цилиндрический',
      description: 'Пилотная многоуровневая спецификация',
    },
  });

  const reducer = await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      designation: 'РЦ-12',
      name: 'Редуктор цилиндрический',
      qty: 1,
      kind: SpecItemKind.ASSEMBLY,
      sortOrder: 0,
    },
  });
  const housing = await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      parentId: reducer.id,
      designation: 'СБ-01',
      name: 'Корпус в сборе',
      qty: 1,
      kind: SpecItemKind.ASSEMBLY,
      sortOrder: 1,
    },
  });
  const cover = await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      parentId: housing.id,
      designation: 'Д-01',
      name: 'Крышка корпуса',
      qty: 1,
      kind: SpecItemKind.PART,
      sortOrder: 2,
    },
  });
  const base = await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      parentId: housing.id,
      designation: 'Д-02',
      name: 'Основание корпуса',
      qty: 1,
      kind: SpecItemKind.PART,
      sortOrder: 3,
    },
  });
  const shaft = await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      parentId: reducer.id,
      designation: 'Д-10',
      name: 'Вал ведущий',
      qty: 1,
      kind: SpecItemKind.PART,
      sortOrder: 4,
    },
  });
  await prisma.specItem.create({
    data: {
      tenantId: tenant.id,
      specId: spec.id,
      parentId: reducer.id,
      designation: 'К-01',
      name: 'Подшипник 6205',
      qty: 2,
      kind: SpecItemKind.MATERIAL,
      sortOrder: 5,
    },
  });

  const op = async (
    specItemId: string,
    seq: number,
    name: string,
    postId: string,
    typeId: string,
    hours: number,
    instruction: string,
  ) =>
    prisma.techOperation.create({
      data: {
        tenantId: tenant.id,
        specItemId,
        seq,
        name,
        postId,
        operationTypeId: typeId,
        timeNormHours: hours,
        instruction,
      },
    });

  await op(
    cover.id,
    10,
    'Точить контур',
    posts.tok.id,
    types.tok.id,
    0.8,
    'Закрепить заготовку. Выдержать размеры по чертежу Д-01. Фаски 1×45°.',
  );
  await op(
    cover.id,
    20,
    'Фрезеровать площадку',
    posts.frez.id,
    types.frez.id,
    0.5,
    'Фрезеровать привалочную плоскость. Шероховатость Ra 3.2.',
  );
  await op(
    base.id,
    10,
    'Точить основание',
    posts.tok.id,
    types.tok.id,
    1.2,
    'Черновое и чистовое точение основания корпуса.',
  );
  await op(
    shaft.id,
    10,
    'Точить вал',
    posts.tok.id,
    types.tok.id,
    1.5,
    'Точить шейки под подшипник. Допуск h6. Не забыть канавки под стопор.',
  );
  await op(
    housing.id,
    10,
    'Собрать корпус',
    posts.sbor.id,
    types.sbor.id,
    0.4,
    'Собрать крышку и основание. Момент затяжки по карте.',
  );
  await op(
    reducer.id,
    10,
    'Собрать редуктор',
    posts.sbor.id,
    types.sbor.id,
    1.0,
    'Установить вал и подшипники. Проверить вращение без заеданий.',
  );
  await op(
    reducer.id,
    20,
    'Контроль',
    posts.sbor.id,
    types.ctrl.id,
    0.3,
    'Проверить осевой люфт и шум. Клеймить годные.',
  );

  const dueSoon = new Date();
  dueSoon.setDate(dueSoon.getDate() + 8);
  const dueYesterday = new Date();
  dueYesterday.setDate(dueYesterday.getDate() - 1);

  const orderLive = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      number: 'З-1001',
      dueDate: dueSoon,
      comment: 'Пилотный заказ на отладку контура',
      lines: {
        create: { tenantId: tenant.id, specId: spec.id, qty: 2 },
      },
    },
  });
  const orderLate = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      number: 'З-1000',
      dueDate: dueYesterday,
      comment: 'Просроченный заказ для дашборда',
      createdAt: new Date(Date.now() - 14 * 86400000),
      lines: {
        create: { tenantId: tenant.id, specId: spec.id, qty: 1 },
      },
    },
  });

  const items = await prisma.specItem.findMany({
    where: { specId: spec.id },
    include: { operations: { orderBy: { seq: 'asc' } } },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const pathQty = (item: (typeof items)[number]) => {
    let q = Number(item.qty);
    let cur: (typeof items)[number] | undefined = item;
    while (cur?.parentId) {
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      q *= Number(parent.qty);
      cur = parent;
    }
    return q;
  };

  async function explode(
    orderId: string,
    qty: number,
    extra: { specItemId: string; count: number }[] = [],
  ) {
    const launch = await prisma.launch.create({
      data: {
        tenantId: tenant.id,
        orderId,
        specId: spec.id,
        qty,
        launchedById: dispatcher.id,
      },
    });
    const plan = new Map<string, { item: (typeof items)[number]; count: number }>();
    for (const item of items) {
      if (item.kind === SpecItemKind.MATERIAL || !item.operations.length) continue;
      plan.set(item.id, { item, count: Math.max(1, Math.round(qty * pathQty(item))) });
    }
    for (const extraRow of extra) {
      const item = byId.get(extraRow.specItemId);
      if (!item) continue;
      const cur = plan.get(item.id);
      if (cur) cur.count += extraRow.count;
      else plan.set(item.id, { item, count: extraRow.count });
    }
    for (const { item, count } of plan.values()) {
      for (let n = 1; n <= count; n += 1) {
        const workItem = await prisma.workItem.create({
          data: {
            tenantId: tenant.id,
            launchId: launch.id,
            orderId,
            specItemId: item.id,
            qrCode: qr(),
            pieceIndex: n,
            qty: 1,
            isPiece: true,
            status: WorkItemStatus.QUEUED,
          },
        });
        for (const operation of item.operations) {
          await prisma.workOperation.create({
            data: {
              tenantId: tenant.id,
              workItemId: workItem.id,
              techOperationId: operation.id,
              seq: operation.seq,
              name: operation.name,
              postId: operation.postId,
              timeNormHours: operation.timeNormHours,
              instruction: operation.instruction,
              status: OperationStatus.PENDING,
            },
          });
        }
      }
    }
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  await explode(orderLive.id, 2);
  await explode(orderLate.id, 1, [{ specItemId: shaft.id, count: 1 }]);

  console.log('Пилот ERPEVV заполнен.');
  console.log('admin@erpevv.local / Admin123!');
  console.log('tech@erpevv.local / Tech123!');
  console.log('disp@erpevv.local / Disp123!');
  console.log('oper@erpevv.local / Oper123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
