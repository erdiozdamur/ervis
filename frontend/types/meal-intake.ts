import type { MealAnalysisStatus, MealInputAssetType } from '@prisma/client';
import type { MealDraftAnalysisResult } from '@/types/meal-analysis';

export type MealIntakeFieldErrors = Partial<Record<'description' | 'images' | 'audio', string>>;

export type MealDraftCreateResult =
  | {
      ok: true;
      mealId: string;
      analysisRunId: string;
      reviewRoute: string;
      dayKey: string;
      analysisStatus: MealAnalysisStatus;
      analysisErrorMessage: string | null;
      draftResult: MealDraftAnalysisResult | null;
      assetCounts: {
        text: number;
        image: number;
        audio: number;
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: MealIntakeFieldErrors;
    };

export type MealDraftReviewAsset = {
  id: string;
  assetType: MealInputAssetType;
  label: string;
  textContent: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  previewRoute: string | null;
  createdAtLabel: string;
  sourceLabel: string | null;
  transcriptText: string | null;
  transcriptStatus: 'completed' | 'failed' | 'skipped' | null;
  transcriptLanguage: string | null;
  transcriptMessage: string | null;
};

export type MealDraftReview = {
  mealId: string;
  dayKey: string;
  dateLabel: string;
  createdAtLabel: string;
  analysisStatus: MealAnalysisStatus;
  analysisRequestedAtLabel: string | null;
  analysisPromptVersion: string | null;
  analysisErrorMessage: string | null;
  imageCount: number;
  audioCount: number;
  textCount: number;
  assets: MealDraftReviewAsset[];
  draftResult: MealDraftAnalysisResult | null;
};
