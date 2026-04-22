'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { Textarea } from '@/components/ui/textarea';

type AppSettingsConfig = {
  timeZone: string;
  uploadMaxFileSizeMb: number;
  experimentalFeatureFlags: string[];
  version: number;
  lastPublishedBy: string | null;
};

type AppSettingsChange = {
  id: string;
  action: string;
  createdAt: string;
  actor: {
    email: string;
  };
};

type AppSettingsResponse = {
  ok: true;
  config: AppSettingsConfig;
  defaults: {
    timeZone: string;
    uploadMaxFileSizeMb: number;
    experimentalFeatureFlags: string[];
  };
  exportConfig: {
    timeZone: string;
    uploadMaxFileSizeMb: number;
    experimentalFeatureFlags: string[];
  };
  changes: AppSettingsChange[];
};

function flagsToText(flags: string[]) {
  return flags.join('\n');
}

function textToFlags(raw: string) {
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AppSettingsPanel() {
  const [config, setConfig] = useState<AppSettingsConfig | null>(null);
  const [defaults, setDefaults] = useState<AppSettingsResponse['defaults'] | null>(null);
  const [timeZone, setTimeZone] = useState('Europe/Istanbul');
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState('12');
  const [flagsText, setFlagsText] = useState('');
  const [importText, setImportText] = useState('');
  const [changes, setChanges] = useState<AppSettingsChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/app-settings', { cache: 'no-store' });
      const payload = (await response.json()) as AppSettingsResponse;

      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? 'App ayarları alınamadı.');
      }

      setConfig(payload.config);
      setDefaults(payload.defaults);
      setTimeZone(payload.config.timeZone);
      setUploadMaxFileSizeMb(String(payload.config.uploadMaxFileSizeMb));
      setFlagsText(flagsToText(payload.config.experimentalFeatureFlags));
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

  async function saveSettings() {
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeZone,
          uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
          experimentalFeatureFlags: textToFlags(flagsText),
        }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Kaydetme başarısız oldu.');
      }

      setInfo('Ayarlar anında yayınlandı. Deploy gerekmez.');
      await fetchState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kaydetme başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetToDefaults() {
    setResetting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/app-settings', { method: 'DELETE' });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Reset başarısız oldu.');
      }

      setInfo('Varsayılan ayarlar geri yüklendi.');
      await fetchState();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Reset başarısız oldu.');
    } finally {
      setResetting(false);
    }
  }

  async function importConfig() {
    setImporting(true);
    setError(null);
    setInfo(null);

    try {
      const parsed = JSON.parse(importText) as AppSettingsResponse['exportConfig'];

      const response = await fetch('/api/admin/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsed }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Import başarısız oldu.');
      }

      setInfo('Config import edildi ve anında yayınlandı.');
      setImportText('');
      await fetchState();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import başarısız oldu.');
    } finally {
      setImporting(false);
    }
  }

  function exportConfig() {
    const payload = {
      timeZone,
      uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
      experimentalFeatureFlags: textToFlags(flagsText),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `app-settings-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <StatePanel variant="loading" title="App Settings yükleniyor" description="Konfigürasyon hazırlanıyor..." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Timezone (örn: Europe/Istanbul)" className="h-12" />
        <Input
          type="number"
          min={1}
          step={1}
          value={uploadMaxFileSizeMb}
          onChange={(event) => setUploadMaxFileSizeMb(event.target.value)}
          placeholder="Upload max MB"
          className="h-12"
        />
      </div>

      <Textarea
        value={flagsText}
        onChange={(event) => setFlagsText(event.target.value)}
        placeholder="Deneysel feature flag'leri satır satır veya virgülle girin"
      />

      <div className="flex flex-wrap gap-2">
        <Button size="md" disabled={submitting || resetting || importing} onClick={saveSettings}>
          {submitting ? 'Yayınlanıyor...' : 'Anında yayınla'}
        </Button>
        <Button variant="secondary" size="md" disabled={submitting || resetting || importing} onClick={resetToDefaults}>
          {resetting ? 'Sıfırlanıyor...' : 'Reset to defaults'}
        </Button>
        <Button variant="ghost" size="md" disabled={submitting || resetting || importing} onClick={exportConfig}>
          Export config
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Import config</h3>
        <Textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"timeZone":"Europe/Istanbul","uploadMaxFileSizeMb":12,"experimentalFeatureFlags":["new-editor"]}' />
        <Button variant="secondary" size="md" disabled={!importText.trim() || importing || submitting || resetting} onClick={importConfig}>
          {importing ? 'Import ediliyor...' : 'Import config'}
        </Button>
      </div>

      {config ? (
        <p className="text-sm text-slate-600">
          Aktif sürüm: v{config.version}. Son yayınlayan: {config.lastPublishedBy ?? 'bilinmiyor'}.
          {defaults ? ` Varsayılan timezone: ${defaults.timeZone}, varsayılan upload limiti: ${defaults.uploadMaxFileSizeMb} MB.` : ''}
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
