import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { tenant: true, employee: true },
    });
    if (!user) {
      throw new UnauthorizedException('Неверная почта или пароль');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Неверная почта или пароль');
    }
    const token = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });
    return { token, user: this.serialize(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, employee: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.serialize(user);
  }

  private serialize(user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tenantId: string;
    employeeId: string | null;
    tenant: { id: string; name: string; code: string };
    employee: { id: string; fullName: string; defaultPostId: string | null } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantCode: user.tenant.code,
      employee: user.employee
        ? {
            id: user.employee.id,
            fullName: user.employee.fullName,
            defaultPostId: user.employee.defaultPostId,
          }
        : null,
    };
  }
}
