import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';

@Module({
  imports: [ProductionModule],
  controllers: [TerminalController],
  providers: [TerminalService],
})
export class TerminalModule {}
