import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { ProductionService } from './production.service';
import { CreateOrderDto, LaunchDto } from './dto';

@Controller()
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNOLOGIST)
  @Get('orders')
  list(@CurrentUser() user: AuthUser) {
    return this.production.listOrders(user.tenantId);
  }

  @Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNOLOGIST)
  @Get('orders/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.getOrder(user.tenantId, id);
  }

  @Roles(Role.ADMIN, Role.DISPATCHER)
  @Post('orders')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.production.createOrder(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.DISPATCHER)
  @Post('orders/:id/launches')
  launch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LaunchDto,
  ) {
    return this.production.launch(user.tenantId, user.id, id, dto);
  }

  @Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNOLOGIST)
  @Get('launches/:id')
  getLaunch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.getLaunch(user.tenantId, id);
  }
}
