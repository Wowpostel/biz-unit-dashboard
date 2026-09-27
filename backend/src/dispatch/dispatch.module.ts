import { Module } from '@nestjs/common';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { ShiftBoardService } from './shift-board.service';

@Module({
  controllers: [DispatchController],
  providers: [DispatchService, ShiftBoardService],
})
export class DispatchModule {}
