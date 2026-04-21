'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import type { AdminAiSettingsPayload, AdminAiSettingsResponse } from '@/types/admin-ai-settings';

type Props = {
  initialSettings: AdminAiSettingsResponse['settings'];
};

export function AiSettingsForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload: AdminAiSettingsPayload = {
    provider: settings.provider,
    openAiApiKey: settings.openAiApiKey,
    openAiModel: settings.openAiModel,
    transcriptionModel: settings.transcriptionModel,
    stage1Model: settings.stage1Model,
    stage2Model: settings.stage2Model,
    analysisPromptVersion: settings.analysisPromptVersion,
    maxInputAssetCount: settings.maxInputAssetCount,
    maxTranscriptCharacters: settings.maxTranscriptCharacters,
    featureImageAnalysis: settings.featureImageAnalysis,
    featureAudioTranscription: settings.featureAudioTranscription,
  };

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          setError(null);

          startTransition(async () => {
            const response = await fetch('/api/admin/ai-settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            const result = (await response.json().catch(() => null)) as AdminAiSettingsResponse | null;

            if (!response.ok || !result?.ok) {
              setError(result?.message ?? 'AI ayarları kaydedilemedi.');
              return;
            }

            setSettings(result.settings);
            setMessage(result.message ?? 'AI ayarları güncellendi.');
          });
        }}
      >
        <h2 className="text-lg font-semibold text-slate-950">AI Ayarları</h2>

        <Input value={settings.provider} onChange={(event) => setSettings((prev) => ({ ...prev, provider: event.target.value }))} placeholder="Provider" />
        <Input value={settings.openAiModel} onChange={(event) => setSettings((prev) => ({ ...prev, openAiModel: event.target.value }))} placeholder="OpenAI model" />
        <Input
          value={settings.transcriptionModel}
          onChange={(event) => setSettings((prev) => ({ ...prev, transcriptionModel: event.target.value }))}
          placeholder="Transcription model"
        />
        <Input value={settings.stage1Model} onChange={(event) => setSettings((prev) => ({ ...prev, stage1Model: event.target.value }))} placeholder="Stage 1 model" />
        <Input value={settings.stage2Model} onChange={(event) => setSettings((prev) => ({ ...prev, stage2Model: event.target.value }))} placeholder="Stage 2 model" />
        <Input
          value={settings.analysisPromptVersion}
          onChange={(event) => setSettings((prev) => ({ ...prev, analysisPromptVersion: event.target.value }))}
          placeholder="Prompt version"
        />
        <Input
          type="password"
          value={settings.openAiApiKey}
          onChange={(event) => setSettings((prev) => ({ ...prev, openAiApiKey: event.target.value }))}
          placeholder={settings.openAiApiKeyConfigured ? 'OpenAI API key (configured)' : 'OpenAI API key'}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            value={settings.maxInputAssetCount}
            onChange={(event) => setSettings((prev) => ({ ...prev, maxInputAssetCount: Number(event.target.value) }))}
            placeholder="Max input asset"
          />
          <Input
            type="number"
            value={settings.maxTranscriptCharacters}
            onChange={(event) => setSettings((prev) => ({ ...prev, maxTranscriptCharacters: Number(event.target.value) }))}
            placeholder="Max transcript chars"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.featureImageAnalysis}
            onChange={(event) => setSettings((prev) => ({ ...prev, featureImageAnalysis: event.target.checked }))}
          />
          Görsel analiz aktif
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.featureAudioTranscription}
            onChange={(event) => setSettings((prev) => ({ ...prev, featureAudioTranscription: event.target.checked }))}
          />
          Ses transkripsiyon aktif
        </label>

        {message ? <StatePanel variant="success" title="Kaydedildi" description={message} /> : null}
        {error ? <StatePanel variant="error" title="Hata" description={error} /> : null}

        <Button type="submit" disabled={isPending} fullWidth>
          {isPending ? 'Kaydediliyor...' : 'AI ayarlarını kaydet'}
        </Button>
      </form>
    </Card>
  );
}
