'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';

type PromptConfig = {
  provider: string;
  model: string;
  promptVersion: string;
  version: number;
  lastPublishedBy: string | null;
};

type PromptStudioChange = {
  id: string;
  action: string;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    role: string;
  };
};

type PromptStudioResponse = {
  ok: true;
  config: PromptConfig;
  changes: PromptStudioChange[];
};

export function PromptStudioPanel() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [promptVersion, setPromptVersion] = useState('');
  const [changes, setChanges] = useState<PromptStudioChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/prompt-studio', { cache: 'no-store' });
      const payload = (await response.json()) as PromptStudioResponse;

      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? 'Prompt ayarları alınamadı.');
      }

      setConfig(payload.config);
      setProvider(payload.config.provider);
      setModel(payload.config.model);
      setPromptVersion(payload.config.promptVersion);
      setChanges(payload.changes);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const canSubmit = useMemo(
    () => provider.trim().length > 0 && model.trim().length > 0 && promptVersion.trim().length > 0,
    [model, promptVersion, provider],
  );

  async function testSettings() {
    if (!canSubmit) {
      return;
    }

    setTesting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/prompt-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model, promptVersion }),
      });

      const payload = (await response.json()) as { message?: string; warnings?: string[] };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Test başarısız oldu.');
      }

      setInfo(payload.warnings?.length ? `${payload.message} ${payload.warnings.join(' ')}` : payload.message ?? 'Test başarılı.');
      await fetchState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Test başarısız oldu.');
    } finally {
      setTesting(false);
    }
  }

  async function saveSettings() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/prompt-studio', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model, promptVersion }),
      });

      const payload = (await response.json()) as { version?: number; message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Kaydetme başarısız oldu.');
      }

      setInfo(`Prompt ayarları kaydedildi. Yeni sürüm: v${payload.version ?? '?'}.`);
      await fetchState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kaydetme başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <StatePanel variant="loading" title="Prompt Studio yükleniyor" description="Ayarlar hazırlanıyor..." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Provider (örn: openai)" className="h-12" />
        <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model (örn: gpt-4.1-mini)" className="h-12" />
        <Input
          value={promptVersion}
          onChange={(event) => setPromptVersion(event.target.value)}
          placeholder="Prompt version (örn: meal-intake-v2)"
          className="h-12"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="md" disabled={!canSubmit || testing || submitting} onClick={testSettings}>
          {testing ? 'Test ediliyor...' : 'Kaydetmeden önce test et'}
        </Button>
        <Button size="md" disabled={!canSubmit || submitting || testing} onClick={saveSettings}>
          {submitting ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>

      {config ? (
        <p className="text-sm text-slate-600">
          Aktif sürüm: v{config.version}. Son yayınlayan: {config.lastPublishedBy ?? 'bilinmiyor'}.
        </p>
      ) : null}

      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Son 10 değişiklik</h3>
        {changes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Henüz değişiklik kaydı yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {changes.map((change) => (
              <li key={change.id} className="rounded-2xl border border-slate-100 px-3 py-2 text-sm text-slate-700">
                <strong>{change.actor.email}</strong> · {change.action} · {new Date(change.createdAt).toLocaleString('tr-TR')}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
