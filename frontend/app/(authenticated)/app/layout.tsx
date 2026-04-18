import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { requireCurrentUser } from '@/lib/auth/session';

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
