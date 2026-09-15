import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { DispatchService } from './dispatch.service';

@Controller('dispatch')
@Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNOLOGIST)
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.dispatch.overview(user.tenantId);
  }
}
