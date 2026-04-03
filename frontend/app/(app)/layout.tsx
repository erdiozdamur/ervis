import { AppSidebar } from '@/components/layout/app-sidebar';
import { requireUser } from '@/server/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="relative flex min-h-screen text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />
      <AppSidebar />
      <div className="relative z-10 flex-1">
        <div className="mx-auto min-h-screen max-w-[1700px] px-3 pb-6 pt-14 sm:px-5 lg:px-8 lg:pt-3">
          <div className="page-enter">{children}</div>
        </div>
      </div>
    </div>
  );
}
