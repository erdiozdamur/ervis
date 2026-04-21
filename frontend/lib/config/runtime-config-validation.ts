import { z } from 'zod';

export const adminAiSettingsSchema = z.object({
  provider: z.string().min(1).max(64),
  openAiApiKey: z.string().max(400).optional().default(''),
  openAiModel: z.string().min(1).max(128),
  transcriptionModel: z.string().min(1).max(128),
  stage1Model: z.string().min(1).max(128),
  stage2Model: z.string().min(1).max(128),
  analysisPromptVersion: z.string().min(1).max(128),
  maxInputAssetCount: z.coerce.number().int().min(1).max(20),
  maxTranscriptCharacters: z.coerce.number().int().min(256).max(20000),
  featureImageAnalysis: z.coerce.boolean(),
  featureAudioTranscription: z.coerce.boolean(),
});
