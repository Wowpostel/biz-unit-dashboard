import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { TerminalService } from './terminal.service';
import { ManualTimeDto, StartTimerDto, StopTimerDto } from './dto';

@Controller('terminal')
@Roles(Role.ADMIN, Role.OPERATOR, Role.DISPATCHER)
export class TerminalController {
  constructor(private readonly terminal: TerminalService) {}

  @Get('scan/:qr')
  scan(
    @CurrentUser() user: AuthUser,
    @Param('qr') qr: string,
    @Query('postId') postId?: string,
  ) {
    return this.terminal.scan(user.tenantId, qr, postId);
  }

  @Get('queue')
  queue(@CurrentUser() user: AuthUser, @Query('postId') postId: string) {
    return this.terminal.queue(user.tenantId, postId);
  }

  @Get('my-open')
  myOpen(@CurrentUser() user: AuthUser) {
    return this.terminal.myOpen(user.tenantId, user.id);
  }

  @Post('start')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartTimerDto) {
    return this.terminal.start(user.tenantId, user.id, dto);
  }

  @Post('stop')
  stop(@CurrentUser() user: AuthUser, @Body() dto: StopTimerDto) {
    return this.terminal.stop(user.tenantId, user.id, dto);
  }

  @Post('manual')
  manual(@CurrentUser() user: AuthUser, @Body() dto: ManualTimeDto) {
    return this.terminal.manual(user.tenantId, user.id, dto);
  }
}
