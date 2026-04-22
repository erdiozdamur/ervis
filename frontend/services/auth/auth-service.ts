import { Prisma, type UserRole } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import type { SignInInput, SignUpInput } from '@/lib/auth/validation';
import type { RegisterUserResult } from '@/types/auth';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  role: UserRole;
  isActive: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function authenticateUserWithPassword(input: SignInInput) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.email) },
  });

  if (!user?.passwordHash || !user.isActive) {
    return null;
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return toAuthUser(user);
}

export async function registerUser(input: SignUpInput): Promise<RegisterUserResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name ?? null,
        email: normalizedEmail,
        passwordHash,
      },
    });

    return {
      ok: true,
      user: toAuthUser(user),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        ok: false,
        code: 'EMAIL_TAKEN',
        message: 'Bu e-posta adresiyle zaten bir hesap var.',
        fieldErrors: {
          email: 'Farklı bir e-posta kullan ya da giriş yap.',
        },
      };
    }

    throw error;
  }
}
