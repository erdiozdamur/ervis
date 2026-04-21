import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { isAdminEmail } from '@/lib/auth/admin';
import { adminAiSettingsSchema } from '@/lib/config/runtime-config-validation';
import { getRuntimeConfig, updateRuntimeConfig } from '@/services/config/runtime-config-service';
import type { AdminAiSettingsResponse } from '@/types/admin-ai-settings';

function toResponseFromRuntimeConfig(runtimeConfig: Awaited<ReturnType<typeof getRuntimeConfig>>): AdminAiSettingsResponse {
  return {
    ok: true,
    settings: {
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
    },
  };
}

async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return null;
  }

  return session;
}

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const runtimeConfig = await getRuntimeConfig();
  return NextResponse.json(toResponseFromRuntimeConfig(runtimeConfig));
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ ok: false, message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminAiSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'AI ayarlarında geçersiz alanlar var.' }, { status: 400 });
  }

  const data = parsed.data;
  const current = await getRuntimeConfig();

  const next = await updateRuntimeConfig({
    updatedBy: session.user.email ?? session.user.id,
    patch: {
      AI_PROVIDER: data.provider,
      OPENAI_API_KEY: data.openAiApiKey.trim() ? data.openAiApiKey.trim() : current.OPENAI_API_KEY,
      OPENAI_MODEL: data.openAiModel,
      OPENAI_TRANSCRIPTION_MODEL: data.transcriptionModel,
      MEAL_ANALYSIS_STAGE1_MODEL: data.stage1Model,
      MEAL_ANALYSIS_STAGE2_MODEL: data.stage2Model,
      AI_ANALYSIS_PROMPT_VERSION: data.analysisPromptVersion,
      AI_MAX_INPUT_ASSET_COUNT: data.maxInputAssetCount,
      AI_MAX_TRANSCRIPT_CHARACTERS: data.maxTranscriptCharacters,
      AI_FEATURE_IMAGE_ANALYSIS: data.featureImageAnalysis,
      AI_FEATURE_AUDIO_TRANSCRIPTION: data.featureAudioTranscription,
    },
  });

  return NextResponse.json({ ...toResponseFromRuntimeConfig(next), message: 'AI ayarları güncellendi.' } satisfies AdminAiSettingsResponse);
}
