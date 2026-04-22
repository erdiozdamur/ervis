'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { Textarea } from '@/components/ui/textarea';
import { createMutationHeaders, createMutationHeadersWithoutJson } from '@/lib/security/mutation-request';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type AppSettingsConfig = {
  appName: string;
  supportEmail: string;
  timeZone: string;
  uploadMaxFileSizeMb: number;
  experimentalFeatureFlags: string[];
  mealDraftReviewEnabled: boolean;
  mealDraftReviewRolloutPercentage: number;
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
  csrfToken: string;
  permissions: {
    canWrite: boolean;
  };
  config: AppSettingsConfig;
  defaults: Omit<AppSettingsConfig, 'version' | 'lastPublishedBy'>;
  exportConfig: Omit<AppSettingsConfig, 'version' | 'lastPublishedBy'>;
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
  const [appName, setAppName] = useState('Ervis Calorie Tracker');
  const [supportEmail, setSupportEmail] = useState('destek@ervis.app');
  const [timeZone, setTimeZone] = useState('Europe/Istanbul');
  const [uploadMaxFileSizeMb, setUploadMaxFileSizeMb] = useState('12');
  const [flagsText, setFlagsText] = useState('');
  const [mealDraftReviewEnabled, setMealDraftReviewEnabled] = useState(false);
  const [mealDraftReviewRolloutPercentage, setMealDraftReviewRolloutPercentage] = useState('0');
  const [importText, setImportText] = useState('');
  const [changes, setChanges] = useState<AppSettingsChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/app-settings', { cache: 'no-store' });
      const payload = (await response.json()) as AppSettingsResponse;

      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? 'Uygulama ayarları alınamadı.');
      }

      setConfig(payload.config);
      setDefaults(payload.defaults);
      setAppName(payload.config.appName);
      setSupportEmail(payload.config.supportEmail);
      setTimeZone(payload.config.timeZone);
      setUploadMaxFileSizeMb(String(payload.config.uploadMaxFileSizeMb));
      setFlagsText(flagsToText(payload.config.experimentalFeatureFlags));
      setMealDraftReviewEnabled(payload.config.mealDraftReviewEnabled);
      setMealDraftReviewRolloutPercentage(String(payload.config.mealDraftReviewRolloutPercentage));
      setChanges(payload.changes);
      setCsrfToken(payload.csrfToken);
      setCanWrite(payload.permissions.canWrite);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  function buildPayload() {
    return {
      appName,
      supportEmail,
      timeZone,
      uploadMaxFileSizeMb: Number(uploadMaxFileSizeMb),
      experimentalFeatureFlags: textToFlags(flagsText),
      mealDraftReviewEnabled,
      mealDraftReviewRolloutPercentage: Number(mealDraftReviewRolloutPercentage),
    };
  }

  async function saveSettings() {
    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/app-settings', {
        method: 'PUT',
        headers: createMutationHeaders(csrfToken),
        body: JSON.stringify(buildPayload()),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Kaydetme başarısız oldu.');
      }

      setInfo('Ayarlar anında yayınlandı. Ek dağıtıma gerek yok.');
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
      const response = await fetch('/api/admin/app-settings', { method: 'DELETE', headers: createMutationHeadersWithoutJson(csrfToken) });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Sıfırlama başarısız oldu.');
      }

      setInfo('Varsayılan ayarlar geri yüklendi.');
      setResetConfirm('');
      await fetchState();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Sıfırlama başarısız oldu.');
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
        headers: createMutationHeaders(csrfToken),
        body: JSON.stringify({ config: parsed }),
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? 'İçe aktarma başarısız oldu.');
      }

      setInfo('Yapılandırma içe aktarıldı ve anında yayınlandı.');
      setImportText('');
      await fetchState();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'İçe aktarma başarısız oldu.');
    } finally {
      setImporting(false);
    }
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `app-settings-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const hasClientValidationError =
    appName.trim().length < 2 ||
    !supportEmail.includes('@') ||
    Number.isNaN(Number(uploadMaxFileSizeMb)) ||
    Number(uploadMaxFileSizeMb) <= 0 ||
    Number(uploadMaxFileSizeMb) > 512 ||
    Number.isNaN(Number(mealDraftReviewRolloutPercentage)) ||
    Number(mealDraftReviewRolloutPercentage) < 0 ||
    Number(mealDraftReviewRolloutPercentage) > 100;

  if (loading) {
    return <StatePanel variant="loading" title="Uygulama ayarları yükleniyor" description="Konfigürasyon hazırlanıyor..." />;
  }

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        title="Uygulama Ayarları"
        description="Uygulama kimliği, operasyonel ayarlar ve panel davranışını bu ekrandan yönetirsiniz."
        hint="Bu alandaki değişiklikler kaydedildiğinde anında canlıya yansır."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 lg:p-5">
          <h3 className="text-base font-semibold text-slate-900">Uygulama Kimliği</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="settings-app-name" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Uygulama adı
              </label>
              <Input id="settings-app-name" value={appName} onChange={(event) => setAppName(event.target.value)} placeholder="Örn: Ervis Calorie Tracker" className="h-12" />
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-support-email" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Destek e-postası
              </label>
              <Input id="settings-support-email" type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="Örn: destek@ervis.app" className="h-12" />
            </div>
          </div>

          <h3 className="text-base font-semibold text-slate-900">Operasyonel Ayarlar</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="settings-timezone" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Saat dilimi
              </label>
              <Input id="settings-timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Örn: Europe/Istanbul" className="h-12" />
            </div>
            <div className="space-y-1">
              <label htmlFor="settings-upload-limit" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Maksimum dosya boyutu (MB)
              </label>
              <Input id="settings-upload-limit" type="number" min={1} step={1} value={uploadMaxFileSizeMb} onChange={(event) => setUploadMaxFileSizeMb(event.target.value)} placeholder="Örn: 12" className="h-12" />
            </div>
          </div>

          <h3 className="text-base font-semibold text-slate-900">Panel Davranışı</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Öğün taslak inceleme özelliği
              <select
                value={mealDraftReviewEnabled ? 'enabled' : 'disabled'}
                onChange={(event) => setMealDraftReviewEnabled(event.target.value === 'enabled')}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900"
              >
                <option value="enabled">Etkin</option>
                <option value="disabled">Kapalı</option>
              </select>
            </label>
            <div className="space-y-1">
              <label htmlFor="settings-rollout" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Kademeli açılış oranı (%)
              </label>
              <Input id="settings-rollout" type="number" min={0} max={100} step={1} value={mealDraftReviewRolloutPercentage} onChange={(event) => setMealDraftReviewRolloutPercentage(event.target.value)} placeholder="0-100" className="h-12" />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="settings-flags" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Deneysel özellik bayrakları
            </label>
            <Textarea id="settings-flags" value={flagsText} onChange={(event) => setFlagsText(event.target.value)} placeholder="Her satıra bir bayrak yazın veya virgülle ayırın" />
          </div>

          <h3 className="text-base font-semibold text-slate-900">İçe aktar</h3>
          <p className="text-sm text-slate-600">Dışa aktardığınız JSON içeriğini bu alana yapıştırabilirsiniz.</p>
          <Textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"appName":"Ervis","supportEmail":"destek@ervis.app","timeZone":"Europe/Istanbul","uploadMaxFileSizeMb":12,"experimentalFeatureFlags":["new-editor"],"mealDraftReviewEnabled":true,"mealDraftReviewRolloutPercentage":100}' />
          <Button variant="secondary" size="md" disabled={!importText.trim() || importing || submitting || resetting || !canWrite} onClick={importConfig}>
            {importing ? 'İçe aktarılıyor...' : 'İçe aktar'}
          </Button>
        </div>

        <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
          <h3 className="text-base font-semibold text-slate-900">Aksiyonlar</h3>
          <div className="flex flex-col gap-2">
            <Button size="md" disabled={submitting || resetting || importing || !canWrite || hasClientValidationError} onClick={saveSettings}>
              {submitting ? 'Yayınlanıyor...' : 'Anında yayınla'}
            </Button>
            <Input
              value={resetConfirm}
              onChange={(event) => setResetConfirm(event.target.value)}
              placeholder="Sıfırlamak için SIFIRLA yazın"
              className="h-12"
            />
            <Button
              variant="secondary"
              size="md"
              disabled={submitting || resetting || importing || !canWrite || resetConfirm.trim().toUpperCase() !== 'SIFIRLA'}
              onClick={resetToDefaults}
            >
              {resetting ? 'Sıfırlanıyor...' : 'Varsayılana sıfırla'}
            </Button>
            <Button variant="ghost" size="md" disabled={submitting || resetting || importing} onClick={exportConfig}>
              Dışa aktar
            </Button>
          </div>
        </aside>
      </div>

      {config ? (
        <p className="text-sm text-slate-600">
          Aktif sürüm: v{config.version}. Son yayınlayan: {config.lastPublishedBy ?? 'bilinmiyor'}.
          {defaults ? ` Varsayılan saat dilimi: ${defaults.timeZone}, varsayılan yükleme limiti: ${defaults.uploadMaxFileSizeMb} MB.` : ''}
        </p>
      ) : null}

      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}
      {!canWrite ? (
        <StatePanel
          variant="empty"
          title="Yazma yetkiniz yok"
          description="Ayarları yayınlama, sıfırlama ve içe aktarma için SUPER_ADMIN veya OWNER rolü gerekir."
        />
      ) : null}

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
