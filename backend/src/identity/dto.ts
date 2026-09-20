import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({ require_tld: false })
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  fullName!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class PatchUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  employeeId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class CreateEmployeeDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  personnelNo?: string;

  @IsOptional()
  @IsString()
  defaultPostId?: string | null;
}

export class PatchEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  personnelNo?: string;

  @IsOptional()
  @IsString()
  defaultPostId?: string | null;
}
