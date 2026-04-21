import { ScreenHeader } from '@/components/layout/screen-header';
import { StatePanel } from '@/components/ui/state-panel';
import { requireCurrentUser } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { notFound } from 'next/navigation';

export default async function AdminPage() {
  const user = await requireCurrentUser();

  if (!isAdminEmail(user.email)) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Admin yetkileri bu sayfadan yönetilecek." />
      <StatePanel
        tone="info"
        title="Admin modülü hazırlanıyor"
        description="Bu kullanıcıya özel yeni yönetim yetkileri bir sonraki adımda burada açılacak."
      />
    </section>
  );
}
