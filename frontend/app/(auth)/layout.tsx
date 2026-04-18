import type { ReactNode } from 'react';
import { redirectIfAuthenticated } from '@/lib/auth/session';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();
  return children;
}
