import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role, StaffKind } from '@prisma/client';

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
  @IsEmail({ require_tld: false })
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
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
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  defaultPostId?: string | null;

  @IsOptional()
  @IsEnum(StaffKind)
  staffKind?: StaffKind;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}

export class PatchEmployeeDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  personnelNo?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  defaultPostId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['WEEKDAYS', 'TWO_TWO', 'CUSTOM'])
  scheduleKind?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekDays?: number[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  shiftStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  shiftEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  breakMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  cycleWorkDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  cycleOffDays?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsString()
  cycleAnchor?: string | null;

  @IsOptional()
  @IsString()
  scheduleComment?: string;

  @IsOptional()
  @IsEnum(StaffKind)
  staffKind?: StaffKind;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
