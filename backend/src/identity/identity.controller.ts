import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { IdentityService } from './identity.service';
import { CreateEmployeeDto, CreateUserDto, PatchEmployeeDto, PatchUserDto } from './dto';

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Roles(Role.ADMIN)
  @Get('roles')
  roles() {
    return this.identity.roles();
  }

  @Roles(Role.ADMIN)
  @Get('users')
  listUsers(@CurrentUser() user: AuthUser) {
    return this.identity.listUsers(user.tenantId);
  }

  @Roles(Role.ADMIN)
  @Post('users')
  createUser(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.identity.createUser(user.tenantId, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('users/:id')
  patchUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchUserDto,
  ) {
    return this.identity.patchUser(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER)
  @Get('employees')
  listEmployees(@CurrentUser() user: AuthUser) {
    return this.identity.listEmployees(user.tenantId);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('employees')
  createEmployee(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.identity.createEmployee(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Patch('employees/:id')
  patchEmployee(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchEmployeeDto,
  ) {
    return this.identity.patchEmployee(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('employees/:id')
  removeEmployee(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.identity.removeEmployee(user.tenantId, id);
  }
}
