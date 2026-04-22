'use client';

import { useEffect, useState } from 'react';
import { StatePanel } from '@/components/ui/state-panel';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type RoleRow = {
  role: string;
  userCount: number;
  permissions: string[];
};

export function RolesPermissionsPanel() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/roles-permissions', { cache: 'no-store' });
        const payload = (await response.json()) as { ok?: boolean; roles?: RoleRow[]; message?: string };

        if (!response.ok || !payload.ok || !payload.roles) {
          throw new Error(payload.message ?? 'Rol ve yetki verisi alınamadı.');
        }

        setRoles(payload.roles);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <StatePanel variant="loading" title="Rol matrisi hazırlanıyor" description="Yetkiler yükleniyor..." />;
  }

  if (error) {
    return <StatePanel variant="error" title="Rol matrisi alınamadı" description={error} />;
  }

  return (
    <div className="space-y-4">
      <AdminModuleHeader
        title="Roller ve Yetkiler"
        description="Hangi rolün ne yapabildiğini ve sistemde bu rolden kaç kullanıcı olduğunu görürsünüz."
        hint="Bu ekran şu an bilgilendirme amaçlıdır; rol atama işlemleri Kullanıcılar ekranından yapılır."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <div key={role.role} className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{role.role}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{role.userCount} kullanıcı</span>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {role.permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
