import type { UserRole } from '@prisma/client';

export type AuthFieldName = 'name' | 'email' | 'password' | 'confirmPassword';

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type RegisterUserResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        emailVerified: Date | null;
        role: UserRole;
      };
    }
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'EMAIL_TAKEN' | 'UNKNOWN';
      message: string;
      fieldErrors?: AuthFieldErrors;
    };
