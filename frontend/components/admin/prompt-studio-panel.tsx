'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { createMutationHeaders, createMutationHeadersWithoutJson } from '@/lib/security/mutation-request';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type PromptConfig = {
  provider: string;
  model: string;
  temperature: number;
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
  csrfToken: string;
  permissions: {
    canWrite: boolean;
  };
  config: PromptConfig;
  previousConfig: Partial<PromptConfig> | null;
  changes: PromptStudioChange[];
  secretStatus: {
    openaiApiKey: 'tanimli' | 'tanimli_degil';
  };
};

type PromptStudioPanelProps = {
  mode?: 'all' | 'ai' | 'prompt';
};

export function PromptStudioPanel({ mode = 'all' }: PromptStudioPanelProps) {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.2');
  const [promptVersion, setPromptVersion] = useState('');
  const [changes, setChanges] = useState<PromptStudioChange[]>([]);
  const [previousConfig, setPreviousConfig] = useState<Partial<PromptConfig> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [smokeChecks, setSmokeChecks] = useState<Array<{ step: string; ok: boolean; detail: string }>>([]);
  const [publishReason, setPublishReason] = useState('');
  const [publishConfirm, setPublishConfirm] = useState('');
  const [fourEyesApproverEmail, setFourEyesApproverEmail] = useState('');
  const [openAiApiKeyStatus, setOpenAiApiKeyStatus] = useState<'tanimli' | 'tanimli_degil'>('tanimli_degil');
  const [csrfToken, setCsrfToken] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState('');

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/prompt-studio', { cache: 'no-store' });
      const payload = (await response.json()) as PromptStudioResponse;

      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? 'Yapay zekâ/istem ayarları alınamadı.');
      }

      setConfig(payload.config);
      setProvider(payload.config.provider);
      setModel(payload.config.model);
      setTemperature(String(payload.config.temperature));
      setPromptVersion(payload.config.promptVersion);
      setPreviousConfig(payload.previousConfig);
      setChanges(payload.changes);
      setOpenAiApiKeyStatus(payload.secretStatus.openaiApiKey);
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

  const canSubmit = useMemo(
    () => provider.trim().length > 0 && model.trim().length > 0 && promptVersion.trim().length > 0 && temperature.trim().length > 0,
    [model, promptVersion, provider, temperature],
  );
  const temperatureValue = Number(temperature);
  const isTemperatureValid = Number.isFinite(temperatureValue) && temperatureValue >= 0 && temperatureValue <= 2;

  const diffRows = useMemo(() => {
    if (!previousConfig) {
      return [];
    }

    const currentRows = {
      provider,
      model,
      temperature,
      promptVersion,
    };

    return Object.entries(currentRows).map(([key, currentValue]) => ({
      key,
      currentValue,
      previousValue: String((previousConfig as Record<string, string | undefined>)[key] ?? '-'),
      changed: currentValue.trim() !== String((previousConfig as Record<string, string | undefined>)[key] ?? '').trim(),
    }));
  }, [model, previousConfig, promptVersion, provider, temperature]);

  function saveDraft() {
    const payload = {
      provider: provider.trim(),
      model: model.trim(),
      temperature: Number(temperature),
      promptVersion: promptVersion.trim(),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem('prompt-studio-draft', JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
    setInfo('Taslak yerel olarak kaydedildi.');
    setError(null);
  }

  function loadDraft() {
    const raw = localStorage.getItem('prompt-studio-draft');
    if (!raw) {
      setError('Kaydedilmiş taslak bulunamadı.');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { provider?: string; model?: string; temperature?: number; promptVersion?: string; savedAt?: string };
      setProvider(parsed.provider ?? '');
      setModel(parsed.model ?? '');
      setTemperature(String(parsed.temperature ?? 0.2));
      setPromptVersion(parsed.promptVersion ?? '');
      setDraftSavedAt(parsed.savedAt ?? null);
      setInfo('Taslak yüklendi.');
      setError(null);
    } catch {
      setError('Taslak okunamadı.');
    }
  }

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
          ...createMutationHeaders(csrfToken),
        },
        body: JSON.stringify({ provider, model, temperature: temperatureValue, promptVersion, reason: publishReason, confirm: publishConfirm, fourEyesApproverEmail }),
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
          ...createMutationHeaders(csrfToken),
        },
        body: JSON.stringify({ provider, model, temperature: temperatureValue, promptVersion, reason: publishReason, confirm: publishConfirm, fourEyesApproverEmail }),
      });

      const payload = (await response.json()) as {
        version?: number;
        message?: string;
        smokeTest?: { checks?: Array<{ step: string; ok: boolean; detail: string }> };
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Kaydetme başarısız oldu.');
      }

      setInfo(`Ayarlar kaydedildi. Yeni sürüm: v${payload.version ?? '?'}.`);
      setSmokeChecks(payload.smokeTest?.checks ?? []);
      setPublishReason('');
      setPublishConfirm('');
      setFourEyesApproverEmail('');
      await fetchState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kaydetme başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  }

  async function rollbackSettings() {
    setRollingBack(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/admin/prompt-studio', {
        method: 'DELETE',
        headers: createMutationHeadersWithoutJson(csrfToken),
      });

      const payload = (await response.json()) as { message?: string; version?: number };
      if (!response.ok) {
        throw new Error(payload.message ?? 'Geri alma işlemi başarısız oldu.');
      }

      setInfo(`Geri alma tamamlandı. Aktif sürüm: v${payload.version ?? '?'}.`);
      setRollbackConfirm('');
      await fetchState();
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Geri alma başarısız oldu.');
    } finally {
      setRollingBack(false);
    }
  }

  if (loading) {
    return <StatePanel variant="loading" title="Yapay zekâ/istem ayarları yükleniyor" description="Ayarlar hazırlanıyor..." />;
  }

  const showAiFields = mode === 'all' || mode === 'ai';
  const showPromptField = mode === 'all' || mode === 'prompt';

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        title={mode === 'ai' ? 'Yapay Zekâ Ayarları' : mode === 'prompt' ? 'İstem Yönetimi' : 'Yapay Zekâ ve İstem Yönetimi'}
        description={
          mode === 'ai'
            ? 'Yapay zekâ sağlayıcısı ve model seçimini bu ekrandan yönetirsiniz.'
            : mode === 'prompt'
              ? 'İstem sürümünü test edip yayınlama işlemlerini bu ekrandan yürütürsünüz.'
              : 'Yapay zekâ sağlayıcısı, model ve prompt sürümünü birlikte yönetirsiniz.'
        }
        hint="Yayınlama öncesi test butonunu kullanın. Kritik değişikliklerde ikinci onay e-postası girmeniz önerilir."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 lg:p-5">
          <h3 className="text-base font-semibold text-slate-900">Ayar Formu</h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {showAiFields ? (
              <>
                <div className="space-y-1">
                  <label htmlFor="ai-provider" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Yapay zekâ sağlayıcısı
                  </label>
                  <Input id="ai-provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Örn: openai" className="h-12" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ai-model" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Yapay zekâ modeli
                  </label>
                  <Input id="ai-model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Örn: gpt-4.1-mini" className="h-12" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ai-temperature" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Sıcaklık (0-2)
                  </label>
                  <Input id="ai-temperature" type="number" min={0} max={2} step={0.1} value={temperature} onChange={(event) => setTemperature(event.target.value)} className="h-12" />
                  {!isTemperatureValid ? <p className="text-xs text-rose-600">Sıcaklık değeri 0 ile 2 arasında olmalıdır.</p> : null}
                </div>
              </>
            ) : null}
            {showPromptField ? (
              <div className="space-y-1">
                <label htmlFor="prompt-version" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  İstem sürümü
                </label>
                <Input id="prompt-version" value={promptVersion} onChange={(event) => setPromptVersion(event.target.value)} placeholder="Örn: meal-intake-v2" className="h-12" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="publish-reason" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Yayınlama gerekçesi
              </label>
              <Input id="publish-reason" value={publishReason} onChange={(event) => setPublishReason(event.target.value)} placeholder="En az 10 karakter" className="h-12" />
            </div>
            <div className="space-y-1">
              <label htmlFor="publish-confirm" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Onay metni
              </label>
              <Input id="publish-confirm" value={publishConfirm} onChange={(event) => setPublishConfirm(event.target.value)} placeholder="ONAYLA" className="h-12" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="four-eyes" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              İkinci onay e-postası (opsiyonel)
            </label>
            <Input
              id="four-eyes"
              value={fourEyesApproverEmail}
              onChange={(event) => setFourEyesApproverEmail(event.target.value)}
              placeholder="Aktif SUPER_ADMIN / OWNER e-posta adresi"
              className="h-12"
            />
          </div>
        </div>

        <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
          <h3 className="text-base font-semibold text-slate-900">Hızlı İşlemler</h3>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="md" disabled={!canSubmit || !isTemperatureValid || testing || submitting || !canWrite} onClick={testSettings}>
              {testing ? 'Test ediliyor...' : 'Kaydetmeden önce test et'}
            </Button>
            <Button variant="ghost" size="md" disabled={!canSubmit || testing || submitting || rollingBack} onClick={saveDraft}>
              Taslağı kaydet
            </Button>
            <Button variant="secondary" size="md" disabled={testing || submitting || rollingBack} onClick={loadDraft}>
              Taslağı yükle
            </Button>
            <Button
              size="md"
              disabled={
                !canSubmit ||
                !isTemperatureValid ||
                !canWrite ||
                publishReason.trim().length < 10 ||
                publishConfirm.trim().toUpperCase() !== 'ONAYLA' ||
                submitting ||
                testing ||
                rollingBack
              }
              onClick={saveSettings}
            >
              {submitting ? 'Yayınlanıyor...' : 'Yayınla'}
            </Button>
            <Input
              value={rollbackConfirm}
              onChange={(event) => setRollbackConfirm(event.target.value)}
              placeholder="Geri alma için GERI_AL yazın"
              className="h-12"
            />
            <Button
              variant="ghost"
              size="md"
              disabled={submitting || testing || rollingBack || !canWrite || rollbackConfirm.trim().toUpperCase() !== 'GERI_AL'}
              onClick={rollbackSettings}
            >
              {rollingBack ? 'Geri alınıyor...' : 'Önceki sürüme dön'}
            </Button>
          </div>
        </aside>
      </div>

      {config ? (
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            Aktif sürüm: v{config.version}. Son yayınlayan: {config.lastPublishedBy ?? 'bilinmiyor'}.
          </p>
          <p>
            OpenAI anahtar durumu: <strong>{openAiApiKeyStatus === 'tanimli' ? 'Tanımlı' : 'Tanımlı değil'}</strong>
          </p>
        </div>
      ) : null}

      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}
      {!canWrite ? (
        <StatePanel
          variant="empty"
          title="Yazma yetkiniz yok"
          description="Test, yayın ve geri alma işlemleri için SUPER_ADMIN veya OWNER rolü gerekir."
        />
      ) : null}
      {draftSavedAt ? <p className="text-xs text-slate-500">Son taslak kaydı: {new Date(draftSavedAt).toLocaleString('tr-TR')}</p> : null}

      {diffRows.length > 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Sürüm farkı (güncel vs önceki)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {diffRows.map((row) => (
              <li key={row.key} className="rounded-2xl border border-slate-100 px-3 py-2 text-slate-700">
                <strong>{row.key}</strong> · eski: <code>{row.previousValue}</code> · yeni: <code>{row.currentValue}</code>{' '}
                {row.changed ? <span className="font-semibold text-amber-700">değişti</span> : <span className="text-slate-500">aynı</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {smokeChecks.length > 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Yayın sonrası doğrulama</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {smokeChecks.map((check) => (
              <li key={check.step}>
                {check.ok ? '✅' : '❌'} {check.step} — {check.detail}
              </li>
            ))}
          </ul>
        </div>
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
