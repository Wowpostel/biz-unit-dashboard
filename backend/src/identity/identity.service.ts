import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, CreateUserDto, PatchEmployeeDto, PatchUserDto } from './dto';

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
    return this.prisma.employee.findMany({
      where: { tenantId },
      include: { defaultPost: true, user: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async createEmployee(tenantId: string, dto: CreateEmployeeDto) {
    if (dto.defaultPostId) await this.ensurePost(tenantId, dto.defaultPostId);
    return this.prisma.employee.create({
      data: {
        tenantId,
        fullName: dto.fullName.trim(),
        personnelNo: dto.personnelNo?.trim() ?? '',
        defaultPostId: dto.defaultPostId || null,
      },
      include: { defaultPost: true, user: true },
    });
  }

  async patchEmployee(tenantId: string, id: string, dto: PatchEmployeeDto) {
    const row = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Сотрудник не найден');
    if (dto.defaultPostId) await this.ensurePost(tenantId, dto.defaultPostId);
    return this.prisma.employee.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        personnelNo: dto.personnelNo?.trim(),
        defaultPostId: dto.defaultPostId === undefined ? undefined : dto.defaultPostId || null,
      },
      include: { defaultPost: true, user: true },
    });
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
}
