import type { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      emailVerified: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    emailVerified?: string | null;
  }
}
