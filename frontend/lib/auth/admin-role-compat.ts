import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/db/prisma';

const PRIVILEGED_ROLE_PRIORITY = ['ADMIN', 'SUPER_ADMIN', 'OWNER'] as const;

export async function getSupportedPrivilegedRoles(): Promise<UserRole[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>(Prisma.sql`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'UserRole'
    `);

    const supportedRoles = new Set(rows.map((row) => row.enumlabel));

    const queryRoles = PRIVILEGED_ROLE_PRIORITY.filter((role) => supportedRoles.has(role));

    if (queryRoles.length > 0) {
      return queryRoles as UserRole[];
    }
  } catch {
    // Fall back to the most widely supported legacy role if enum introspection fails.
  }

  return [UserRole.ADMIN];
}
