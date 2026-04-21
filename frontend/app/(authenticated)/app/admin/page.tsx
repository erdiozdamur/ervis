import { ScreenHeader } from '@/components/layout/screen-header';
import { AiSettingsForm } from '@/components/admin/ai-settings-form';
import { requireCurrentUser } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { getRuntimeConfig } from '@/services/config/runtime-config-service';
import { notFound } from 'next/navigation';
import { getAnalysisRules } from '@/services/meal-analysis/analysis-rule-repository';
import { AnalysisRulesEditor } from '@/components/admin/analysis-rules-editor';

export default async function AdminPage() {
  const user = await requireCurrentUser();
  const hasAccess = await requireAdminPageAccess(user.id);

  if (!hasAccess) {
    notFound();
  }

  const runtimeConfig = await getRuntimeConfig();

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Uygulama çalışma zamanındaki AI ayarlarını buradan yönetebilirsin." />
      <AiSettingsForm
        initialSettings={{
          provider: runtimeConfig.AI_PROVIDER,
          openAiApiKey: '',
          openAiApiKeyConfigured: Boolean(runtimeConfig.OPENAI_API_KEY),
          openAiModel: runtimeConfig.OPENAI_MODEL,
          transcriptionModel: runtimeConfig.OPENAI_TRANSCRIPTION_MODEL,
          stage1Model: runtimeConfig.MEAL_ANALYSIS_STAGE1_MODEL,
          stage2Model: runtimeConfig.MEAL_ANALYSIS_STAGE2_MODEL,
          analysisPromptVersion: runtimeConfig.AI_ANALYSIS_PROMPT_VERSION,
          maxInputAssetCount: runtimeConfig.AI_MAX_INPUT_ASSET_COUNT,
          maxTranscriptCharacters: runtimeConfig.AI_MAX_TRANSCRIPT_CHARACTERS,
          featureImageAnalysis: runtimeConfig.AI_FEATURE_IMAGE_ANALYSIS,
          featureAudioTranscription: runtimeConfig.AI_FEATURE_AUDIO_TRANSCRIPTION,
        }}
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">secret</th>
              <th className="px-4 py-3 font-medium">configured</th>
              <th className="px-4 py-3 font-medium">last_rotated_at</th>
              <th className="px-4 py-3 font-medium">source</th>
            </tr>
          </thead>
          <tbody>
            {secretStatuses.map((secret) => (
              <tr key={secret.key} className="border-t border-slate-200">
                <td className="px-4 py-3 font-mono text-xs">{secret.key}</td>
                <td className="px-4 py-3">{String(secret.configured)}</td>
                <td className="px-4 py-3">{secret.lastRotatedAt ?? '-'}</td>
                <td className="px-4 py-3">{secret.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
