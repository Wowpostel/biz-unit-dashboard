import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StartTimerDto {
  @IsString()
  workOperationId!: string;

  @IsString()
  postId!: string;
}

export class StopTimerDto {
  @IsString()
  timeEntryId!: string;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}

export class ManualTimeDto {
  @IsString()
  workOperationId!: string;

  @IsString()
  postId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hours!: number;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
