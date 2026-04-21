export type AdminAiSettingsPayload = {
  provider: string;
  openAiApiKey: string;
  openAiModel: string;
  transcriptionModel: string;
  stage1Model: string;
  stage2Model: string;
  analysisPromptVersion: string;
  maxInputAssetCount: number;
  maxTranscriptCharacters: number;
  featureImageAnalysis: boolean;
  featureAudioTranscription: boolean;
};

export type AdminAiSettingsResponse = {
  ok: boolean;
  settings: AdminAiSettingsPayload & {
    openAiApiKeyConfigured: boolean;
  };
  message?: string;
};
