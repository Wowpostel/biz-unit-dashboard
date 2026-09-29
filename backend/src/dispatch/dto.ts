import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {
  @IsString()
  date!: string;

  @IsString()
  employeeId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  actualEmployeeId?: string | null;

  @IsOptional()
  @IsString()
  note?: string;
}

export class WalkInDto {
  @IsString()
  date!: string;

  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
