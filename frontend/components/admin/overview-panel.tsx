'use client';

import { useEffect, useState } from 'react';
import { StatWidget } from '@/components/ui/stat-widget';
import { StatePanel } from '@/components/ui/state-panel';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type OverviewResponse = {
  ok: true;
  stats: {
    totalUsers: number;
    activeUsers: number;
    passiveUsers: number;
    adminUsers: number;
  };
  versions: {
    aiModel: { version: number; publishedAt: string; publishedBy: string } | null;
    prompt: { version: number; publishedAt: string; publishedBy: string } | null;
    appSettings: { version: number; publishedAt: string; publishedBy: string } | null;
    featureFlags: { version: number; publishedAt: string; publishedBy: string } | null;
  };
  latestAudit: {
    action: string;
    resourceType: string;
    resourceKey: string;
    createdAt: string;
    actorEmail: string;
  } | null;
};

export function OverviewPanel() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/overview', { cache: 'no-store' });
        const payload = (await response.json()) as OverviewResponse | { message?: string };
        if (!response.ok || !('ok' in payload)) {
          throw new Error(('message' in payload ? payload.message : null) ?? 'Genel bakış verisi alınamadı.');
        }

        setData(payload);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <StatePanel variant="loading" title="Genel bakış hazırlanıyor" description="Yönetim metrikleri yükleniyor..." />;
  }

  if (error || !data) {
    return <StatePanel variant="error" title="Genel bakış alınamadı" description={error ?? 'Veri bulunamadı.'} />;
  }

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        title="Genel Bakış"
        description="Yönetim panelindeki temel göstergeleri tek ekranda görürsünüz."
        hint="Nereden başlayacağınızı bilmiyorsanız bu ekrandaki sayı ve son değişiklik bilgilerini kontrol edin."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatWidget label="Toplam kullanıcı" value={String(data.stats.totalUsers)} />
        <StatWidget label="Aktif kullanıcı" value={String(data.stats.activeUsers)} tone="accent" />
        <StatWidget label="Pasif kullanıcı" value={String(data.stats.passiveUsers)} />
        <StatWidget label="Aktif admin" value={String(data.stats.adminUsers)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Sürüm özeti</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>AI model ayarları: v{data.versions.aiModel?.version ?? '-'}</li>
            <li>Prompt yönetimi: v{data.versions.prompt?.version ?? '-'}</li>
            <li>Uygulama ayarları: v{data.versions.appSettings?.version ?? '-'}</li>
            <li>Özellik bayrakları: v{data.versions.featureFlags?.version ?? '-'}</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Son değişiklik</h3>
          {data.latestAudit ? (
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>
                <strong>{data.latestAudit.actorEmail}</strong> · {data.latestAudit.action}
              </p>
              <p>
                {data.latestAudit.resourceType} / {data.latestAudit.resourceKey}
              </p>
              <p>{new Date(data.latestAudit.createdAt).toLocaleString('tr-TR')}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Henüz kayıtlı bir değişiklik bulunmuyor.</p>
          )}
        </div>
      </div>
    </div>
  );
}
