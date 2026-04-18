import type { ReactNode } from 'react';
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav';
import { AppTopBar } from '@/components/layout/app-top-bar';
import { MobileAppShell } from '@/components/layout/mobile-app-shell';

type AppShellProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <MobileAppShell footer={<MobileBottomNav />} className="pb-36">
      <div className="sticky safe-top top-0 z-20 -mx-1 mb-5">
        <AppTopBar user={user} />
      </div>
      <div className="animate-fade-up space-y-6">{children}</div>
    </MobileAppShell>
  );
}
