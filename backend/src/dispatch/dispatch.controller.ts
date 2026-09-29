import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { DispatchService } from './dispatch.service';
import { ShiftBoardService } from './shift-board.service';
import { MarkAttendanceDto, WalkInDto } from './dto';

@Controller('dispatch')
@Roles(Role.ADMIN, Role.DISPATCHER, Role.TECHNOLOGIST)
export class DispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly shifts: ShiftBoardService,
  ) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.dispatch.overview(user.tenantId);
  }

  @Get('shift')
  shift(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.shifts.board(user.tenantId, date);
  }

  @Post('shift/mark')
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkAttendanceDto) {
    return this.shifts.mark(user.tenantId, dto);
  }

  @Post('shift/walk-in')
  walkIn(@CurrentUser() user: AuthUser, @Body() dto: WalkInDto) {
    return this.shifts.walkIn(user.tenantId, dto);
  }
}
