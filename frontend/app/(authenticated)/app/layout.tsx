import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { requireCurrentUser } from '@/lib/auth/session';
import { getUserProfileSnapshot } from '@/services/profile/profile-service';

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const profile = await getUserProfileSnapshot(user.id);
  const needsProfileCompletion = !profile.values || !profile.targets;

  return (
    <AppShell user={user} needsProfileCompletion={needsProfileCompletion}>
      {children}
    </AppShell>
  );
}
