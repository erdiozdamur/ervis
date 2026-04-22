'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatePanel } from '@/components/ui/state-panel';
import { createMutationHeaders } from '@/lib/security/mutation-request';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type FeatureFlagsResponse = {
  ok: true;
  csrfToken: string;
  permissions: {
    canWrite: boolean;
  };
  config: {
    flags: string[];
    version: number;
    publishedBy: string | null;
  };
};

function parseFlags(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function FeatureFlagsPanel() {
  const [flagsText, setFlagsText] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [publishedBy, setPublishedBy] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function fetchState() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/feature-flags', { cache: 'no-store' });
      const payload = (await response.json()) as FeatureFlagsResponse | { message?: string };
      if (!response.ok || !('ok' in payload)) {
        throw new Error(('message' in payload ? payload.message : null) ?? 'Özellik bayrakları alınamadı.');
      }

      setFlagsText(payload.config.flags.join('\n'));
      setVersion(payload.config.version);
      setPublishedBy(payload.config.publishedBy);
      setCsrfToken(payload.csrfToken);
      setCanWrite(payload.permissions.canWrite);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
  }, []);

  async function saveFlags() {
    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'PUT',
        headers: createMutationHeaders(csrfToken),
        body: JSON.stringify({ flags: parseFlags(flagsText) }),
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string; config?: { version: number } };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? 'Özellik bayrakları kaydedilemedi.');
      }

      setInfo(`Özellik bayrakları yayınlandı. Yeni sürüm: v${payload.config?.version ?? '?'}.`);
      await fetchState();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <StatePanel variant="loading" title="Özellik yönetimi yükleniyor" description="Özellik bayrağı alanları hazırlanıyor..." />;
  }

  return (
    <div className="space-y-4">
      <AdminModuleHeader
        title="Özellik Yönetimi"
        description="Yeni özellikleri kademeli açıp kapatmak için bayrakları bu ekrandan yönetirsiniz."
        hint="Her satıra bir bayrak adı yazın. Yanlış bir bayrak adı girerseniz ilgili özellik çalışmaz."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <label htmlFor="feature-flags-textarea" className="text-sm font-semibold text-slate-900">
          Özellik bayrakları listesi
        </label>
        <p className="mt-1 text-sm text-slate-600">Her satıra bir bayrak adı girin. Virgül ile de ayırabilirsiniz.</p>
        <Textarea
          id="feature-flags-textarea"
          className="mt-3"
          value={flagsText}
          onChange={(event) => setFlagsText(event.target.value)}
          placeholder="new-editor\naudio-retry\nmeal-review-v2"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={saveFlags} disabled={saving || !canWrite}>
            {saving ? 'Kaydediliyor...' : 'Bayrakları yayınla'}
          </Button>
          <span className="text-sm text-slate-600">Aktif sürüm: v{version ?? '-'}</span>
          <span className="text-sm text-slate-600">Son yayınlayan: {publishedBy ?? 'bilinmiyor'}</span>
        </div>
      </div>
      {!canWrite ? (
        <StatePanel
          variant="empty"
          title="Yazma yetkiniz yok"
          description="Bu alanda değişiklik yayınlamak için SUPER_ADMIN veya OWNER rolü gerekir."
        />
      ) : null}

      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}
    </div>
  );
}
