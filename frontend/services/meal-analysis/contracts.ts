import type { MealType, PrismaClient } from '@prisma/client';
import type { MealAnalysisAssetInput, MealStage1Estimate, MealStage1EstimatedItem, MealStage2Resolution, ResolvedNutritionMacros } from '@/types/meal-analysis';
export type { ResolvedNutritionMacros } from '@/types/meal-analysis';

export type MealAnalysisContext = {
  mealId: string;
  userId: string;
  analysisRunId: string;
  consumedAt: Date;
  mealType: MealType;
  assets: MealAnalysisAssetInput[];
};

export type MealAnalysisStage1Estimator = {
  provider: string;
  model: string;
  estimate(context: MealAnalysisContext): Promise<MealStage1Estimate>;
};

export type MealAnalysisStage2NutritionResolver = {
  provider: string;
  model: string;
  resolve(
    context: MealAnalysisContext,
    estimate: MealStage1Estimate,
    db: PrismaClient,
  ): Promise<MealStage2Resolution>;
};

export type ResolvedNutritionTemplate = ResolvedNutritionMacros & {
  confidence: number;
  reasoning: string;
};

export type HeuristicFoodTemplate = {
  canonicalName: string;
  localizedName: string;
  slug: string;
  keywords: string[];
  safeVariantKeywords?: string[];
  macros: ResolvedNutritionMacros;
  confidence: number;
  reasoning: string;
  defaultServingAmount?: number;
  defaultServingUnit?: string;
};

export type MealAnalysisDependencies = {
  stage1Estimator: MealAnalysisStage1Estimator;
  stage2Resolver: MealAnalysisStage2NutritionResolver;
};

export type ParsedTextFoodSegment = {
  displayName: string;
  normalizedQuery: string;
  quantityText: string | null;
  quantityMultiplier: number;
};

export type Stage1ItemFactoryInput = {
  displayName: string;
  normalizedQuery: string;
  quantityText: string | null;
  quantityMultiplier: number;
  sourceAssetIds: string[];
  confidence: number;
  unresolved: boolean;
  reasoning: string;
};

export type Stage1ItemFactory = (input: Stage1ItemFactoryInput) => MealStage1EstimatedItem;
