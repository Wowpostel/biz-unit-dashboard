import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
}

export class CreateOperationTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;
}
