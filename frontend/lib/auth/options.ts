import { PrismaAdapter } from '@auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { AUTH_SIGN_IN_PATH } from '@/lib/auth/constants';
import { getServerEnv } from '@/lib/env';
import { signInSchema } from '@/lib/auth/validation';
import { authenticateUserWithPassword } from '@/services/auth/auth-service';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: getServerEnv().AUTH_SECRET,
  debug: getServerEnv().NODE_ENV === 'development',
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * getServerEnv().AUTH_SESSION_MAX_AGE_DAYS,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: AUTH_SIGN_IN_PATH,
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        return authenticateUserWithPassword(parsed.data);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        const emailVerified =
          'emailVerified' in user && user.emailVerified instanceof Date ? user.emailVerified.toISOString() : null;
        const role = 'role' in user && typeof user.role === 'string' ? (user.role as UserRole) : 'USER';
        token.emailVerified = emailVerified;
        token.role = role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        session.user.emailVerified = typeof token.emailVerified === 'string' ? token.emailVerified : null;
        session.user.role = token.role ?? 'USER';
      }

      return session;
    },
  },
};
