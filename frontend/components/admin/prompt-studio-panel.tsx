'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { createMutationHeaders, createMutationHeadersWithoutJson } from '@/lib/security/mutation-request';

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
  csrfToken: string;
  config: PromptConfig;
  previousConfig: Partial<PromptConfig> | null;
  changes: PromptStudioChange[];
  secretStatus: {
    openaiApiKey: 'configured' | 'not configured';
  };
};

export function PromptStudioPanel() {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
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
  const [openAiApiKeyStatus, setOpenAiApiKeyStatus] = useState<'configured' | 'not configured'>('not configured');
  const [csrfToken, setCsrfToken] = useState('');

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
      setPreviousConfig(payload.previousConfig);
      setChanges(payload.changes);
      setOpenAiApiKeyStatus(payload.secretStatus.openaiApiKey);
      setCsrfToken(payload.csrfToken);
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

  const diffRows = useMemo(() => {
    if (!previousConfig) {
      return [];
    }

    const currentRows = {
      provider,
      model,
      promptVersion,
    };

    return Object.entries(currentRows).map(([key, currentValue]) => ({
      key,
      currentValue,
      previousValue: String((previousConfig as Record<string, string | undefined>)[key] ?? '-'),
      changed: currentValue.trim() !== String((previousConfig as Record<string, string | undefined>)[key] ?? '').trim(),
    }));
  }, [model, previousConfig, promptVersion, provider]);

  function saveDraft() {
    const payload = {
      provider: provider.trim(),
      model: model.trim(),
      promptVersion: promptVersion.trim(),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem('prompt-studio-draft', JSON.stringify(payload));
    setDraftSavedAt(payload.savedAt);
    setInfo('Draft local olarak kaydedildi.');
    setError(null);
  }

  function loadDraft() {
    const raw = localStorage.getItem('prompt-studio-draft');
    if (!raw) {
      setError('Kaydedilmiş draft bulunamadı.');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { provider?: string; model?: string; promptVersion?: string; savedAt?: string };
      setProvider(parsed.provider ?? '');
      setModel(parsed.model ?? '');
      setPromptVersion(parsed.promptVersion ?? '');
      setDraftSavedAt(parsed.savedAt ?? null);
      setInfo('Draft yüklendi.');
      setError(null);
    } catch {
      setError('Draft okunamadı.');
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
        body: JSON.stringify({ provider, model, promptVersion, reason: publishReason, confirm: publishConfirm, fourEyesApproverEmail }),
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
        body: JSON.stringify({ provider, model, promptVersion, reason: publishReason, confirm: publishConfirm, fourEyesApproverEmail }),
      });

      const payload = (await response.json()) as {
        version?: number;
        message?: string;
        smokeTest?: { checks?: Array<{ step: string; ok: boolean; detail: string }> };
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Kaydetme başarısız oldu.');
      }

      setInfo(`Prompt ayarları kaydedildi. Yeni sürüm: v${payload.version ?? '?'}.`);
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
        throw new Error(payload.message ?? 'Rollback başarısız oldu.');
      }

      setInfo(`Rollback tamamlandı. Aktif sürüm: v${payload.version ?? '?'}.`);
      await fetchState();
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Rollback başarısız oldu.');
    } finally {
      setRollingBack(false);
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
        <Button variant="ghost" size="md" disabled={!canSubmit || testing || submitting || rollingBack} onClick={saveDraft}>
          Draft kaydet
        </Button>
        <Button variant="secondary" size="md" disabled={testing || submitting || rollingBack} onClick={loadDraft}>
          Draft yükle
        </Button>
        <Button
          size="md"
          disabled={!canSubmit || publishReason.trim().length < 10 || publishConfirm.trim().toUpperCase() !== 'ONAYLA' || submitting || testing || rollingBack}
          onClick={saveSettings}
        >
          {submitting ? 'Yayınlanıyor...' : 'Publish'}
        </Button>
        <Button variant="ghost" size="md" disabled={submitting || testing || rollingBack} onClick={rollbackSettings}>
          {rollingBack ? 'Rollback...' : 'Rollback'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={publishReason}
          onChange={(event) => setPublishReason(event.target.value)}
          placeholder="Publish gerekçesi (zorunlu, min 10 karakter)"
          className="h-12 md:col-span-2"
        />
        <Input value={publishConfirm} onChange={(event) => setPublishConfirm(event.target.value)} placeholder="ONAYLA" className="h-12" />
      </div>
      <Input
        value={fourEyesApproverEmail}
        onChange={(event) => setFourEyesApproverEmail(event.target.value)}
        placeholder="4-eyes için SUPER_ADMIN e-posta (opsiyonel)"
        className="h-12"
      />

      {config ? (
        <div className="space-y-1 text-sm text-slate-600">
          <p>
            Aktif sürüm: v{config.version}. Son yayınlayan: {config.lastPublishedBy ?? 'bilinmiyor'}.
          </p>
          <p>
            OpenAI API Key: <strong>{openAiApiKeyStatus}</strong>
          </p>
        </div>
      ) : null}

      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}
      {draftSavedAt ? <p className="text-xs text-slate-500">Son draft kaydı: {new Date(draftSavedAt).toLocaleString('tr-TR')}</p> : null}

      {diffRows.length > 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">Diff viewer (vN vs vN-1)</h3>
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
          <h3 className="text-base font-semibold text-slate-900">Publish sonrası smoke test</h3>
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
