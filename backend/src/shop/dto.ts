import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PatchPostDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentIds?: string[];
}

export class CreateOperationTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  defaultPostId?: string | null;
}

export class CreateEquipmentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  inventoryNo?: string;

  @IsOptional()
  @IsString()
  postId?: string | null;
}

export class PatchEquipmentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  inventoryNo?: string;

  @IsOptional()
  @IsString()
  postId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
