import { getRuntimeConfig } from '@/services/config/runtime-config-service';

const OPENAI_AUDIO_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

type ParsedTranscriptionPayload = {
  transcriptText: string;
  language: string | null;
  durationSeconds: number | null;
};

export type AudioTranscriptionResult =
  | {
      status: 'completed';
      transcriptText: string;
      provider: 'openai';
      model: string;
      language: string | null;
      durationSeconds: number | null;
      message: null;
    }
  | {
      status: 'failed' | 'skipped';
      transcriptText: null;
      provider: 'openai';
      model: string;
      language: null;
      durationSeconds: null;
      message: string;
    };

function normalizeTranscriptText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseOpenAiAudioTranscriptionPayload(payload: unknown): ParsedTranscriptionPayload {
  const data = payload && typeof payload === 'object' ? payload : null;
  const transcriptText = data && 'text' in data && typeof data.text === 'string' ? normalizeTranscriptText(data.text) : '';

  if (!transcriptText) {
    throw new Error('The transcription response did not include usable transcript text.');
  }

  return {
    transcriptText,
    language: data && 'language' in data && typeof data.language === 'string' ? data.language : null,
    durationSeconds: data && 'duration' in data && typeof data.duration === 'number' ? data.duration : null,
  };
}

export async function transcribeMealAudioFile(file: File): Promise<AudioTranscriptionResult> {
  const runtimeConfig = await getRuntimeConfig();
  const model = runtimeConfig.OPENAI_TRANSCRIPTION_MODEL;

  if (runtimeConfig.AI_PROVIDER !== 'openai' || !runtimeConfig.AI_FEATURE_AUDIO_TRANSCRIPTION) {
    return {
      status: 'skipped',
      transcriptText: null,
      provider: 'openai',
      model,
      language: null,
      durationSeconds: null,
      message: 'Audio transcription is only configured for the OpenAI provider right now.',
    };
  }

  if (!runtimeConfig.OPENAI_API_KEY) {
    return {
      status: 'skipped',
      transcriptText: null,
      provider: 'openai',
      model,
      language: null,
      durationSeconds: null,
      message: 'Audio transcription is not configured in this environment yet.',
    };
  }

  try {
    const formData = new FormData();
    formData.set('file', file, file.name || 'meal-audio.webm');
    formData.set('model', model);
    formData.set('language', 'tr');

    const response = await fetch(OPENAI_AUDIO_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runtimeConfig.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const apiError =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'The transcription provider rejected the audio request.';

      return {
        status: 'failed',
        transcriptText: null,
        provider: 'openai',
        model,
        language: null,
        durationSeconds: null,
        message: apiError,
      };
    }

    const parsedPayload = parseOpenAiAudioTranscriptionPayload(payload);

    return {
      status: 'completed',
      transcriptText: parsedPayload.transcriptText,
      provider: 'openai',
      model,
      language: parsedPayload.language,
      durationSeconds: parsedPayload.durationSeconds,
      message: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      transcriptText: null,
      provider: 'openai',
      model,
      language: null,
      durationSeconds: null,
      message: error instanceof Error ? error.message : 'The audio transcription request failed unexpectedly.',
    };
  }
}
