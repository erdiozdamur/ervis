import { ScreenHeader } from '@/components/layout/screen-header';
import { StatePanel } from '@/components/ui/state-panel';
import { requireCurrentUser } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { getAdminSecretStatusesSafe } from '@/services/secrets/secret-admin-service';
import { notFound } from 'next/navigation';

export default async function AdminPage() {
  const user = await requireCurrentUser();

  if (!isAdminEmail(user.email)) {
    notFound();
  }

  const secretStatuses = await getAdminSecretStatusesSafe();

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Secret yapılandırma durumları maskelemiş olarak gösterilir." />
      <StatePanel
        variant="success"
        title="Secret Durumları"
        description="Güvenlik gereği secret değerleri hiçbir zaman geri gösterilmez. Yalnızca durum bilgileri listelenir."
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">secret</th>
              <th className="px-4 py-3 font-medium">configured</th>
              <th className="px-4 py-3 font-medium">last_rotated_at</th>
              <th className="px-4 py-3 font-medium">source</th>
            </tr>
          </thead>
          <tbody>
            {secretStatuses.map((secret) => (
              <tr key={secret.key} className="border-t border-slate-200">
                <td className="px-4 py-3 font-mono text-xs">{secret.key}</td>
                <td className="px-4 py-3">{String(secret.configured)}</td>
                <td className="px-4 py-3">{secret.lastRotatedAt ?? '-'}</td>
                <td className="px-4 py-3">{secret.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
