import { Module } from '@nestjs/common';
import { EngineeringModule } from '../engineering/engineering.module';
import { ProductionModule } from '../production/production.module';
import { TerminalController } from './terminal.controller';
import { TerminalService } from './terminal.service';

@Module({
  imports: [ProductionModule, EngineeringModule],
  controllers: [TerminalController],
  providers: [TerminalService],
})
export class TerminalModule {}
