import { ScreenHeader } from '@/components/layout/screen-header';
import { AiSettingsForm } from '@/components/admin/ai-settings-form';
import { requireCurrentUser } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';
import { getRuntimeConfig } from '@/services/config/runtime-config-service';
import { notFound } from 'next/navigation';

export default async function AdminPage() {
  const user = await requireCurrentUser();

  if (!isAdminEmail(user.email)) {
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
    </section>
  );
}
