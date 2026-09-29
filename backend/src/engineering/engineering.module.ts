import { Module } from '@nestjs/common';
import { EngineeringController } from './engineering.controller';
import { EngineeringService } from './engineering.service';
import { PartImagesService } from './part-images.service';

@Module({
  controllers: [EngineeringController],
  providers: [EngineeringService, PartImagesService],
  exports: [EngineeringService, PartImagesService],
})
export class EngineeringModule {}
