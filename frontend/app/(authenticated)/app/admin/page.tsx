import { ScreenHeader } from '@/components/layout/screen-header';
import { requireCurrentUser } from '@/lib/auth/session';
import { requireAdminPageAccess } from '@/lib/auth/admin';
import { notFound } from 'next/navigation';
import { AdminTabs } from '@/components/admin/admin-tabs';

export default async function AdminPage() {
  const user = await requireCurrentUser();
  const hasAccess = await requireAdminPageAccess(user.id);

  if (!hasAccess) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <ScreenHeader
        eyebrow="Yönetim"
        title="Yönetim Paneli"
        description="Kullanıcı, prompt, AI ve sistem ayarlarını tek yerden yönetebilirsiniz."
      />
      <AdminTabs />
    </section>
  );
}
