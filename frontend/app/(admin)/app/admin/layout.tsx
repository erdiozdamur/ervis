import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppTopBar } from '@/components/layout/app-top-bar';
import { getCurrentUser } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-[#f1efeb]">
      <div className="mx-auto w-full max-w-[1880px] px-8 py-6">
        <div className="mb-6">
          <AppTopBar user={user} />
        </div>
        {children}
      </div>
    </div>
  );
}
