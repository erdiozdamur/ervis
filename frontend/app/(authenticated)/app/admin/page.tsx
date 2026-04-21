import { Role } from '@prisma/client';
import { ScreenHeader } from '@/components/layout/screen-header';
import { UserRoleManager } from '@/components/admin/user-role-manager';
import { requireCurrentUser } from '@/lib/auth/session';
import { canAccessAdminPanel } from '@/lib/auth/admin';
import { notFound } from 'next/navigation';

export default async function AdminPage() {
  const user = await requireCurrentUser();

  if (!(await canAccessAdminPanel(user.id))) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Admin yetkileri bu sayfadan yönetilecek." />
      <div className="flex items-center gap-2 border-b border-slate-200">
        <span className="rounded-t-lg border border-b-0 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
          Kullanıcılar
        </span>
      </div>
      <UserRoleManager actorUserId={user.id} roles={Object.values(Role)} />
    </section>
  );
}
