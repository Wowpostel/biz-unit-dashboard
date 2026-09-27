import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { onShiftOnDate, parseAnchor, utcDay } from '../identity/schedule';
import { MarkAttendanceDto, WalkInDto } from './dto';

@Injectable()
export class ShiftBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async board(tenantId: string, dateRaw?: string) {
    const day = this.dayOf(dateRaw);
    const people = await this.prisma.employee.findMany({
      where: { tenantId, isActive: true },
      include: { defaultPost: true },
      orderBy: [{ staffKind: 'asc' }, { fullName: 'asc' }],
    });
    const plannedIds = people.filter((p) => onShiftOnDate(p, day) === true).map((p) => p.id);
    if (plannedIds.length) {
      await this.prisma.shiftAttendance.createMany({
        data: plannedIds.map((employeeId) => ({
          tenantId,
          day,
          employeeId,
          scheduled: true,
          status: AttendanceStatus.PLANNED,
        })),
        skipDuplicates: true,
      });
    }
    const existing = await this.prisma.shiftAttendance.findMany({
      where: { tenantId, day },
      include: {
        employee: { include: { defaultPost: true } },
        actualEmployee: true,
      },
    });
    const rows = existing.map((r) => this.serialize(r));
    rows.sort((a, b) => {
      const rank: Record<string, number> = { SHOP_CHIEF: 0, MASTER: 1, WORKER: 2, OFFICE: 3 };
      const ra = rank[a.staffKind] ?? 9;
      const rb = rank[b.staffKind] ?? 9;
      if (ra !== rb) return ra - rb;
      const ka = `${a.shiftStart} ${a.fullName}`;
      const kb = `${b.shiftStart} ${b.fullName}`;
      return ka.localeCompare(kb, 'ru');
    });
    const planned = rows.filter((r) => r.scheduled);
    const here = rows.filter((r) => r.status === 'SHOWED' || r.status === 'WALK_IN');
    const covered = rows.filter((r) => r.status === 'SUBSTITUTE');
    const missing = rows.filter((r) => r.status === 'NO_SHOW');
    const unmarked = rows.filter((r) => r.status === 'PLANNED');
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.shiftStart}–${r.shiftEnd}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return {
      date: day.toISOString().slice(0, 10),
      counts: {
        planned: planned.length,
        here: here.length,
        covered: covered.length,
        missing: missing.length,
        unmarked: unmarked.length,
      },
      groups: [...groups.entries()].map(([shift, items]) => ({ shift, items })),
      people: people.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        staffKind: p.staffKind,
        jobTitle: p.jobTitle,
      })),
    };
  }

  async mark(tenantId: string, dto: MarkAttendanceDto) {
    const day = this.dayOf(dto.date);
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } });
    if (!emp) throw new NotFoundException('Сотрудник не найден');
    if (dto.status === AttendanceStatus.SUBSTITUTE && !dto.actualEmployeeId) {
      throw new BadRequestException('Для подмены укажите, кто вышел');
    }
    if (dto.actualEmployeeId) {
      const sub = await this.prisma.employee.findFirst({
        where: { id: dto.actualEmployeeId, tenantId },
      });
      if (!sub) throw new BadRequestException('Кто вышел — не найден');
    }
    const scheduled = onShiftOnDate(emp, day) === true;
    const row = await this.prisma.shiftAttendance.upsert({
      where: { tenantId_day_employeeId: { tenantId, day, employeeId: emp.id } },
      create: {
        tenantId,
        day,
        employeeId: emp.id,
        scheduled,
        status: dto.status,
        actualEmployeeId:
          dto.status === AttendanceStatus.SUBSTITUTE ? dto.actualEmployeeId || null : null,
        note: dto.note?.trim() ?? '',
        markedAt: new Date(),
      },
      update: {
        status: dto.status,
        actualEmployeeId:
          dto.status === AttendanceStatus.SUBSTITUTE ? dto.actualEmployeeId || null : null,
        note: dto.note?.trim() ?? '',
        markedAt: new Date(),
        scheduled,
      },
    });
    if (dto.status === AttendanceStatus.SUBSTITUTE && dto.actualEmployeeId) {
      const sub = await this.prisma.employee.findFirst({
        where: { id: dto.actualEmployeeId, tenantId },
      });
      if (sub) {
        const subScheduled = onShiftOnDate(sub, day) === true;
        await this.prisma.shiftAttendance.upsert({
          where: {
            tenantId_day_employeeId: { tenantId, day, employeeId: sub.id },
          },
          create: {
            tenantId,
            day,
            employeeId: sub.id,
            scheduled: subScheduled,
            status: subScheduled ? AttendanceStatus.SHOWED : AttendanceStatus.WALK_IN,
            note: `Подмена за ${emp.fullName}`,
            markedAt: new Date(),
          },
          update: {
            status: subScheduled ? AttendanceStatus.SHOWED : AttendanceStatus.WALK_IN,
            note: `Подмена за ${emp.fullName}`,
            markedAt: new Date(),
            scheduled: subScheduled,
          },
        });
      }
    }
    return this.board(tenantId, dto.date);
  }

  async walkIn(tenantId: string, dto: WalkInDto) {
    const day = this.dayOf(dto.date);
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } });
    if (!emp) throw new NotFoundException('Сотрудник не найден');
    await this.prisma.shiftAttendance.upsert({
      where: { tenantId_day_employeeId: { tenantId, day, employeeId: emp.id } },
      create: {
        tenantId,
        day,
        employeeId: emp.id,
        scheduled: onShiftOnDate(emp, day) === true,
        status: AttendanceStatus.WALK_IN,
        note: dto.note?.trim() ?? 'Вышел вне графика',
        markedAt: new Date(),
      },
      update: {
        status: AttendanceStatus.WALK_IN,
        note: dto.note?.trim() ?? 'Вышел вне графика',
        markedAt: new Date(),
      },
    });
    return this.board(tenantId, dto.date);
  }

  private dayOf(raw?: string) {
    const parsed = parseAnchor(raw || '') ?? utcDay(new Date());
    return parsed;
  }

  private serialize(row: {
    id: string;
    scheduled: boolean;
    status: AttendanceStatus;
    note: string;
    markedAt: Date | null;
    employee: {
      id: string;
      fullName: string;
      personnelNo: string;
      jobTitle: string;
      staffKind: string;
      shiftStart: string;
      shiftEnd: string;
      defaultPost: { name: string } | null;
    };
    actualEmployee: { id: string; fullName: string } | null;
  }) {
    return {
      id: row.id,
      employeeId: row.employee.id,
      fullName: row.employee.fullName,
      personnelNo: row.employee.personnelNo,
      jobTitle: row.employee.jobTitle,
      staffKind: row.employee.staffKind,
      postName: row.employee.defaultPost?.name ?? '—',
      shiftStart: row.employee.shiftStart,
      shiftEnd: row.employee.shiftEnd,
      scheduled: row.scheduled,
      status: row.status,
      actualEmployeeId: row.actualEmployee?.id ?? null,
      actualName: row.actualEmployee?.fullName ?? null,
      note: row.note,
      markedAt: row.markedAt,
    };
  }
}
