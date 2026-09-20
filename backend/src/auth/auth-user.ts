import { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  employeeId: string | null;
};
