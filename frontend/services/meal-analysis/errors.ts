import type { MealAnalysisPipelineStage } from '@/types/meal-analysis';

export class MealAnalysisError extends Error {
  code: string;
  stage: MealAnalysisPipelineStage;
  details?: unknown;

  constructor({
    code,
    stage,
    message,
    details,
  }: {
    code: string;
    stage: MealAnalysisPipelineStage;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = 'MealAnalysisError';
    this.code = code;
    this.stage = stage;
    this.details = details;
  }
}

export function toMealAnalysisError(error: unknown, fallbackStage: MealAnalysisPipelineStage) {
  if (error instanceof MealAnalysisError) {
    return error;
  }

  return new MealAnalysisError({
    code: 'analysis_unexpected_failure',
    stage: fallbackStage,
    message: 'The meal analysis pipeline failed unexpectedly.',
    details: error,
  });
}
