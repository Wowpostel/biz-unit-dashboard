import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StaffKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, CreateUserDto, PatchEmployeeDto, PatchUserDto } from './dto';
import { normalizeWeekDays, onShiftToday, parseAnchor, scheduleLabel } from './schedule';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      include: { employee: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async createUser(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findFirst({ where: { tenantId, email } });
    if (exists) {
      throw new BadRequestException('Пользователь с такой почтой уже есть');
    }
    if (dto.employeeId) {
      await this.ensureEmployee(tenantId, dto.employeeId);
    }
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName.trim(),
        role: dto.role,
        employeeId: dto.employeeId || null,
      },
      include: { employee: true },
    });
  }

  async patchUser(tenantId: string, id: string, dto: PatchUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName) data.fullName = dto.fullName.trim();
    if (dto.role) data.role = dto.role;
    if (dto.isActive != null) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.employeeId !== undefined) {
      if (dto.employeeId) await this.ensureEmployee(tenantId, dto.employeeId);
      data.employee = dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : { disconnect: true };
    }
    return this.prisma.user.update({
      where: { id },
      data,
      include: { employee: true },
    });
  }

  listEmployees(tenantId: string) {
    return this.prisma.employee
      .findMany({
        where: { tenantId },
        include: { defaultPost: true, user: true },
        orderBy: { fullName: 'asc' },
      })
      .then((rows) => rows.map((r) => this.serializeEmployee(r)));
  }

  async createEmployee(tenantId: string, dto: CreateEmployeeDto) {
    if (dto.defaultPostId) await this.ensurePost(tenantId, dto.defaultPostId);
    const row = await this.prisma.employee.create({
      data: {
        tenantId,
        fullName: dto.fullName.trim(),
        personnelNo: dto.personnelNo?.trim() ?? '',
        defaultPostId: dto.defaultPostId || null,
        staffKind: dto.staffKind ?? StaffKind.WORKER,
        jobTitle: dto.jobTitle?.trim() ?? '',
      },
      include: { defaultPost: true, user: true },
    });
    return this.serializeEmployee(row);
  }

  async patchEmployee(tenantId: string, id: string, dto: PatchEmployeeDto) {
    const row = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Сотрудник не найден');
    if (dto.defaultPostId) await this.ensurePost(tenantId, dto.defaultPostId);
    const data: Prisma.EmployeeUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.personnelNo !== undefined) data.personnelNo = dto.personnelNo.trim();
    if (dto.defaultPostId !== undefined) {
      data.defaultPost = dto.defaultPostId
        ? { connect: { id: dto.defaultPostId } }
        : { disconnect: true };
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.scheduleKind !== undefined) data.scheduleKind = dto.scheduleKind;
    if (dto.weekDays !== undefined) data.weekDays = { set: normalizeWeekDays(dto.weekDays) };
    if (dto.shiftStart !== undefined) data.shiftStart = dto.shiftStart;
    if (dto.shiftEnd !== undefined) data.shiftEnd = dto.shiftEnd;
    if (dto.breakMinutes !== undefined) data.breakMinutes = dto.breakMinutes;
    if (dto.cycleWorkDays !== undefined) data.cycleWorkDays = dto.cycleWorkDays;
    if (dto.cycleOffDays !== undefined) data.cycleOffDays = dto.cycleOffDays;
    if (dto.cycleAnchor !== undefined) {
      data.cycleAnchor = parseAnchor(dto.cycleAnchor);
    }
    if (dto.scheduleComment !== undefined) data.scheduleComment = dto.scheduleComment.trim();
    if (dto.staffKind !== undefined) data.staffKind = dto.staffKind;
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle.trim();
    const saved = await this.prisma.employee.update({
      where: { id },
      data,
      include: { defaultPost: true, user: true },
    });
    return this.serializeEmployee(saved);
  }

  async removeEmployee(tenantId: string, id: string) {
    const row = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Сотрудник не найден');
    await this.prisma.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
    await this.prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  roles() {
    return Object.values(Role);
  }

  private async ensureEmployee(tenantId: string, id: string) {
    const row = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!row) throw new BadRequestException('Сотрудник не найден в этом тенанте');
  }

  private async ensurePost(tenantId: string, id: string) {
    const row = await this.prisma.post.findFirst({ where: { id, tenantId } });
    if (!row) throw new BadRequestException('Пост не найден');
  }

  private serializeEmployee(row: {
    id: string;
    fullName: string;
    personnelNo: string;
    defaultPostId: string | null;
    defaultPost: { id: string; name: string; code: string } | null;
    isActive: boolean;
    staffKind: string;
    jobTitle: string;
    scheduleKind: string;
    weekDays: number[];
    shiftStart: string;
    shiftEnd: string;
    breakMinutes: number;
    cycleWorkDays: number;
    cycleOffDays: number;
    cycleAnchor: Date | null;
    scheduleComment: string;
    user: { id: string; email: string } | null;
  }) {
    const today = onShiftToday(row);
    return {
      id: row.id,
      fullName: row.fullName,
      personnelNo: row.personnelNo,
      defaultPostId: row.defaultPostId,
      defaultPost: row.defaultPost,
      isActive: row.isActive,
      staffKind: row.staffKind,
      jobTitle: row.jobTitle,
      scheduleKind: row.scheduleKind,
      weekDays: row.weekDays,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      breakMinutes: row.breakMinutes,
      cycleWorkDays: row.cycleWorkDays,
      cycleOffDays: row.cycleOffDays,
      cycleAnchor: row.cycleAnchor ? row.cycleAnchor.toISOString().slice(0, 10) : null,
      scheduleComment: row.scheduleComment,
      loginEmail: row.user?.email ?? null,
      scheduleLabel: scheduleLabel(row),
      onShiftToday: today,
    };
  }
}
