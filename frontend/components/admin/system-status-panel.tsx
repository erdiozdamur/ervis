'use client';

import { useEffect, useState } from 'react';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusPill } from '@/components/ui/status-pill';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type SystemStatusPayload = {
  ok: true;
  status: 'ok' | 'degraded';
  generatedAt: string;
  checks: {
    database: {
      ok: boolean;
      latencyMs: number | null;
      error: string | null;
    };
    runtime: Array<{ key: string; ok: boolean; message: string }>;
    secrets: {
      OPENAI_API_KEY: 'tanimli' | 'tanimli_degil';
    };
  };
};

export function SystemStatusPanel() {
  const [data, setData] = useState<SystemStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/system-status', { cache: 'no-store' });
        const payload = (await response.json()) as SystemStatusPayload | { message?: string };

        if (!response.ok || !('ok' in payload)) {
          throw new Error(('message' in payload ? payload.message : null) ?? 'Sistem durumu alınamadı.');
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
    return <StatePanel variant="loading" title="Sistem durumu kontrol ediliyor" description="Anlık sağlık verisi hazırlanıyor..." />;
  }

  if (error || !data) {
    return <StatePanel variant="error" title="Sistem durumu alınamadı" description={error ?? 'Veri bulunamadı.'} />;
  }

  return (
    <div className="space-y-4">
      <AdminModuleHeader
        title="Sistem Durumu"
        description="Uygulamanın çalışması için kritik kontrollerin anlık durumunu görürsünüz."
        hint="Sorun varsa önce veritabanı ve çalışma zamanı kontrollerini kontrol edin."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Genel durum</h3>
          <StatusPill tone={data.status === 'ok' ? 'success' : 'neutral'}>{data.status === 'ok' ? 'Sağlıklı' : 'Uyarı var'}</StatusPill>
        </div>
        <p className="mt-2 text-sm text-slate-600">Son kontrol: {new Date(data.generatedAt).toLocaleString('tr-TR')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Veritabanı</h3>
          <p className="mt-2 text-sm text-slate-700">Durum: {data.checks.database.ok ? 'Bağlı' : 'Bağlantı hatası'}</p>
          <p className="text-sm text-slate-700">Gecikme: {data.checks.database.latencyMs ?? '-'} ms</p>
          {data.checks.database.error ? <p className="mt-2 text-sm text-rose-600">{data.checks.database.error}</p> : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Gizli anahtar durumu</h3>
          <p className="mt-2 text-sm text-slate-700">OPENAI_API_KEY: {data.checks.secrets.OPENAI_API_KEY === 'tanimli' ? 'Tanımlı' : 'Tanımlı değil'}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Çalışma zamanı kontrolleri</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {data.checks.runtime.map((check) => (
            <li key={check.key} className="rounded-2xl border border-slate-100 px-3 py-2">
              <strong>{check.key}</strong> · {check.ok ? 'OK' : 'Eksik'} · {check.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
