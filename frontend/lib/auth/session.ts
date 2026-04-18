import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { AUTH_APP_PATH, AUTH_SIGN_IN_PATH } from '@/lib/auth/constants';

export const getCurrentSession = cache(() => getServerSession(authOptions));

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`${AUTH_SIGN_IN_PATH}?next=${encodeURIComponent(AUTH_APP_PATH)}`);
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (user) {
    redirect(AUTH_APP_PATH);
  }
}
