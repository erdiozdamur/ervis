import type { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      emailVerified: string | null;
      role: UserRole;
      isActive: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    emailVerified?: string | null;
    role?: UserRole;
    isActive?: boolean;
  }
}
