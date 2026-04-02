import { AppSidebar } from '@/components/layout/app-sidebar';
import { requireUser } from '@/server/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
