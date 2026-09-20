import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @IsString()
  specId!: string;

  @IsNumber()
  @Min(0.001)
  qty!: number;
}

export class CreateOrderDto {
  @IsString()
  number!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}

export class ExtraPieceDto {
  @IsString()
  specItemId!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

export class LaunchDto {
  @IsString()
  specId!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraPieceDto)
  extraPieces?: ExtraPieceDto[];
}
