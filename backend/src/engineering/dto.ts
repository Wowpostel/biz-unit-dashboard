import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SpecItemKind } from '@prisma/client';

export class CreateSpecDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SpecItemInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  parentClientId?: string | null;

  @IsNumber()
  sortOrder!: number;

  @IsString()
  designation!: string;

  @IsString()
  name!: string;

  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsEnum(SpecItemKind)
  kind!: SpecItemKind;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechOperationInputDto)
  operations?: TechOperationInputDto[];
}

export class SaveSpecItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecItemInputDto)
  items!: SpecItemInputDto[];
}

export class TechOperationInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNumber()
  seq!: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  operationTypeId?: string | null;

  @IsOptional()
  @IsString()
  postId?: string | null;

  @IsNumber()
  timeNormHours!: number;

  @IsOptional()
  @IsString()
  instruction?: string;
}

export class SaveTechOperationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechOperationInputDto)
  operations!: TechOperationInputDto[];
}

export class LookupPartsDto {
  @IsArray()
  @IsString({ each: true })
  keys!: string[];
}
