import type { MealAnalysisStatus, MealType } from '@prisma/client';

export type MealAnalysisPipelineStage =
  | 'input_received'
  | 'analysis_run_created'
  | 'stage_1_estimation'
  | 'stage_2_nutrition_resolution'
  | 'draft_result_returned';

export type MealAnalysisAssetInput = {
  id: string;
  assetType: 'TEXT' | 'IMAGE' | 'AUDIO';
  source: string | null;
  textContent: string | null;
  mimeType: string | null;
  storageKey: string | null;
  labelHint: string | null;
  createdAt: string;
};

export type MealStage1EstimatedItem = {
  id: string;
  displayName: string;
  normalizedQuery: string;
  quantityText: string | null;
  quantityMultiplier: number;
  gramsEstimate?: number | null;
  sourceAssetIds: string[];
  confidence: number;
  unresolved: boolean;
  reasoning: string;
};

export type MealStage1Estimate = {
  stage: 'stage_1_estimation';
  provider: string;
  model: string;
  mealTypeSuggestion: MealType;
  mealTitleSuggestion: string;
  warnings: string[];
  estimatedItems: MealStage1EstimatedItem[];
};

export type ResolvedNutritionMacros = {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

export type MealStage2ResolvedItem = {
  id: string;
  displayName: string;
  normalizedQuery: string;
  quantityText: string | null;
  quantityMultiplier: number;
  gramsEstimate: number | null;
  sourceAssetIds: string[];
  confidence: number;
  unresolved: boolean;
  reasoning: string;
  nutritionSource: 'CACHE' | 'CATALOG' | 'FRESH_ANALYSIS' | 'USER_REVIEW';
  nutritionCacheEntryId: string | null;
  normalizedFoodEntryId: string | null;
  resolutionMetadata: {
    method: 'shared_cache' | 'shared_catalog' | 'fresh_analysis' | 'user_review';
    matchConfidence: number;
    matchedKeyword: string | null;
  };
  macros: ResolvedNutritionMacros;
};

export type MealStage2Resolution = {
  stage: 'stage_2_nutrition_resolution';
  provider: string;
  model: string;
  warnings: string[];
  resolvedItems: MealStage2ResolvedItem[];
};

export type MealDraftAnalysisResult = {
  contractVersion: 'meal-draft-result-v1';
  mealId: string;
  analysisRunId: string;
  editable: true;
  mealTypeSuggestion: MealType;
  titleSuggestion: string;
  warnings: string[];
  items: MealStage2ResolvedItem[];
  totals: ResolvedNutritionMacros;
  stageTrace: {
    stage1: {
      provider: string;
      model: string;
      warningCount: number;
      itemCount: number;
    };
    stage2: {
      provider: string;
      model: string;
      warningCount: number;
      itemCount: number;
      unresolvedItemCount: number;
    };
  };
  generatedAt: string;
};

export type MealAnalysisResponseSnapshot = {
  status: MealAnalysisStatus;
  stagesCompleted: MealAnalysisPipelineStage[];
  inputAssetCount: number;
  warnings: string[];
  stage1Estimate: MealStage1Estimate | null;
  stage2Resolution: MealStage2Resolution | null;
  finishedAt: string | null;
};

export type MealAnalysisExecutionResult =
  | {
      ok: true;
      status: 'SUCCEEDED';
      mealId: string;
      analysisRunId: string;
      draftResult: MealDraftAnalysisResult;
      response: MealAnalysisResponseSnapshot;
    }
  | {
      ok: false;
      status: 'FAILED';
      mealId: string;
      analysisRunId: string;
      error: {
        code: string;
        stage: MealAnalysisPipelineStage;
        message: string;
      };
      response: MealAnalysisResponseSnapshot;
    };

export type MealAnalysisRunResponse =
  | {
      ok: true;
      status: 'SUCCEEDED';
      analysisRunId: string;
      mealId: string;
      draftResult: MealDraftAnalysisResult;
    }
  | {
      ok: false;
      status: 'FAILED';
      analysisRunId: string;
      mealId: string;
      error: {
        code: string;
        stage: MealAnalysisPipelineStage;
        message: string;
      };
    };

export type EditableMealDraftItemInput = {
  id: string;
  displayName: string;
  quantityText: string | null;
  gramsEstimate: number | null;
  macros: ResolvedNutritionMacros;
};

export type MealDraftResultUpdateInput = {
  titleSuggestion: string;
  mealTypeSuggestion: MealType;
  items: EditableMealDraftItemInput[];
};

export type MealDraftResultFieldErrors = Partial<Record<string, string>>;

export type MealDraftResultUpdateResult =
  | {
      ok: true;
      draftResult: MealDraftAnalysisResult;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: MealDraftResultFieldErrors;
    };

export type MealDraftConfirmResult =
  | {
      ok: true;
      mealId: string;
      redirectTo: string;
    }
  | {
      ok: false;
      message: string;
    };
