import { prisma } from '@/db/prisma';
import { getRuntimeConfig } from '@/services/config/runtime-config-service';
import type { MealAnalysisDependencies, MealAnalysisContext } from '@/services/meal-analysis/contracts';
import { DefaultMealStage1Estimator } from '@/services/meal-analysis/default-stage1-estimator';
import { DefaultMealStage2NutritionResolver } from '@/services/meal-analysis/default-stage2-nutrition-resolver';
import { MealAnalysisError, toMealAnalysisError } from '@/services/meal-analysis/errors';
import { getMealAnalysisPromptStamp } from '@/services/meal-analysis/prompt-template-service';
import type {
  MealAnalysisAssetInput,
  MealAnalysisExecutionResult,
  MealAnalysisResponseSnapshot,
  MealDraftAnalysisResult,
  MealStage2ResolvedItem,
} from '@/types/meal-analysis';

function createInitialResponse(inputAssetCount: number): MealAnalysisResponseSnapshot {
  return {
    status: 'RUNNING',
    stagesCompleted: ['input_received', 'analysis_run_created'],
    inputAssetCount,
    warnings: [],
    stage1Estimate: null,
    stage2Resolution: null,
    finishedAt: null,
  };
}

function sumResolvedItems(items: MealStage2ResolvedItem[]) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + item.macros.calories,
      proteinGrams: totals.proteinGrams + item.macros.proteinGrams,
      carbGrams: totals.carbGrams + item.macros.carbGrams,
      fatGrams: totals.fatGrams + item.macros.fatGrams,
      fiberGrams: totals.fiberGrams + item.macros.fiberGrams,
    }),
    {
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
      fiberGrams: 0,
    },
  );
}

function buildDraftResult(context: MealAnalysisContext, stage1Estimate: MealAnalysisResponseSnapshot['stage1Estimate'], stage2Resolution: MealAnalysisResponseSnapshot['stage2Resolution']): MealDraftAnalysisResult {
  if (!stage1Estimate || !stage2Resolution) {
    throw new MealAnalysisError({
      code: 'analysis_missing_stage_outputs',
      stage: 'draft_result_returned',
      message: 'Draft result could not be built because one or more stage outputs were missing.',
    });
  }

  const totals = sumResolvedItems(stage2Resolution.resolvedItems);

  return {
    contractVersion: 'meal-draft-result-v1',
    mealId: context.mealId,
    analysisRunId: context.analysisRunId,
    editable: true,
    mealTypeSuggestion: stage1Estimate.mealTypeSuggestion,
    titleSuggestion: stage1Estimate.mealTitleSuggestion,
    warnings: Array.from(new Set([...stage1Estimate.warnings, ...stage2Resolution.warnings])),
    items: stage2Resolution.resolvedItems,
    totals,
    stageTrace: {
      stage1: {
        provider: stage1Estimate.provider,
        model: stage1Estimate.model,
        warningCount: stage1Estimate.warnings.length,
        itemCount: stage1Estimate.estimatedItems.length,
      },
      stage2: {
        provider: stage2Resolution.provider,
        model: stage2Resolution.model,
        warningCount: stage2Resolution.warnings.length,
        itemCount: stage2Resolution.resolvedItems.length,
        unresolvedItemCount: stage2Resolution.resolvedItems.filter((item) => item.unresolved).length,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getMealAnalysisContext(userId: string, mealId: string, analysisRunId: string): Promise<MealAnalysisContext> {
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      consumedAt: true,
      mealType: true,
      inputAssets: {
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          id: true,
          assetType: true,
          textContent: true,
          mimeType: true,
          storageKey: true,
          metadataJson: true,
          createdAt: true,
        },
      },
    },
  });

  if (!meal) {
    throw new MealAnalysisError({
      code: 'analysis_meal_not_found',
      stage: 'input_received',
      message: 'The requested meal draft could not be found.',
    });
  }

  const supportedAssets = meal.inputAssets.flatMap<MealAnalysisAssetInput>((asset) => {
    if (asset.assetType !== 'TEXT' && asset.assetType !== 'IMAGE' && asset.assetType !== 'AUDIO') {
      return [];
    }

    const metadata = asset.metadataJson && typeof asset.metadataJson === 'object' ? asset.metadataJson : null;
    const metadataTranscript =
      metadata && 'transcriptText' in metadata && typeof metadata.transcriptText === 'string' ? metadata.transcriptText : null;
    const originalName = metadata && 'originalName' in metadata && typeof metadata.originalName === 'string' ? metadata.originalName : null;

    return [
      {
        id: asset.id,
        assetType: asset.assetType,
        source:
          asset.metadataJson && typeof asset.metadataJson === 'object' && 'source' in asset.metadataJson
            ? String(asset.metadataJson.source)
            : null,
        textContent: asset.textContent ?? metadataTranscript,
        mimeType: asset.mimeType,
        storageKey: asset.storageKey,
        labelHint: originalName,
        createdAt: asset.createdAt.toISOString(),
      },
    ];
  });

  if (supportedAssets.length === 0) {
    throw new MealAnalysisError({
      code: 'analysis_no_supported_assets',
      stage: 'input_received',
      message: 'The meal draft does not contain supported analysis inputs.',
    });
  }

  return {
    mealId: meal.id,
    userId: meal.userId,
    analysisRunId,
    consumedAt: meal.consumedAt,
    mealType: meal.mealType,
    assets: supportedAssets,
  };
}

export function getMealAnalysisDependencies(): MealAnalysisDependencies {
  return {
    stage1Estimator: new DefaultMealStage1Estimator(),
    stage2Resolver: new DefaultMealStage2NutritionResolver(),
  };
}

export async function executeMealAnalysisRun({
  userId,
  mealId,
  analysisRunId,
  dependencies = getMealAnalysisDependencies(),
}: {
  userId: string;
  mealId: string;
  analysisRunId: string;
  dependencies?: MealAnalysisDependencies;
}): Promise<MealAnalysisExecutionResult> {
  const context = await getMealAnalysisContext(userId, mealId, analysisRunId);
  let responseSnapshot = createInitialResponse(context.assets.length);

  await prisma.mealAnalysisRun.update({
    where: { id: analysisRunId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      responseJson: responseSnapshot,
    },
  });

  try {
    const stage1Estimate = await dependencies.stage1Estimator.estimate(context);
    responseSnapshot = {
      ...responseSnapshot,
      stagesCompleted: [...responseSnapshot.stagesCompleted, 'stage_1_estimation'],
      warnings: stage1Estimate.warnings,
      stage1Estimate,
    };

    await prisma.mealAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        responseJson: responseSnapshot,
      },
    });

    const stage2Resolution = await dependencies.stage2Resolver.resolve(context, stage1Estimate, prisma);
    responseSnapshot = {
      ...responseSnapshot,
      stagesCompleted: [...responseSnapshot.stagesCompleted, 'stage_2_nutrition_resolution'],
      warnings: Array.from(new Set([...responseSnapshot.warnings, ...stage2Resolution.warnings])),
      stage2Resolution,
    };

    const draftResult = buildDraftResult(context, stage1Estimate, stage2Resolution);
    responseSnapshot = {
      ...responseSnapshot,
      status: 'SUCCEEDED',
      stagesCompleted: [...responseSnapshot.stagesCompleted, 'draft_result_returned'],
      finishedAt: draftResult.generatedAt,
    };

    await prisma.mealAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: 'SUCCEEDED',
        completedAt: new Date(),
        responseJson: responseSnapshot,
        draftResultJson: draftResult,
      },
    });

    return {
      ok: true,
      status: 'SUCCEEDED',
      mealId,
      analysisRunId,
      draftResult,
      response: responseSnapshot,
    };
  } catch (error) {
    const analysisError = toMealAnalysisError(error, 'draft_result_returned');

    responseSnapshot = {
      ...responseSnapshot,
      status: 'FAILED',
      finishedAt: new Date().toISOString(),
    };

    await prisma.mealAnalysisRun.update({
      where: { id: analysisRunId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: analysisError.message,
        responseJson: responseSnapshot,
      },
    });

    return {
      ok: false,
      status: 'FAILED',
      mealId,
      analysisRunId,
      error: {
        code: analysisError.code,
        stage: analysisError.stage,
        message: analysisError.message,
      },
      response: responseSnapshot,
    };
  }
}

export async function createAndExecuteMealAnalysisRun({
  userId,
  mealId,
}: {
  userId: string;
  mealId: string;
}) {
  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
      analysisRuns: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          requestFingerprint: true,
          requestJson: true,
          promptVersion: true,
        },
      },
    },
  });

  if (!meal) {
    throw new MealAnalysisError({
      code: 'analysis_meal_not_found',
      stage: 'input_received',
      message: 'The requested meal draft could not be found.',
    });
  }

  const latestRun = meal.analysisRuns[0];
  const env = getServerEnv();
  const promptStamp = await getMealAnalysisPromptStamp();

  const createdRun = await prisma.mealAnalysisRun.create({
    data: {
      mealId: meal.id,
      userId,
      status: 'QUEUED',
      provider: env.AI_PROVIDER,
      model: env.MEAL_ANALYSIS_STAGE1_MODEL,
      promptVersion: latestRun?.promptVersion ?? promptStamp ?? env.AI_ANALYSIS_PROMPT_VERSION,
      requestFingerprint: latestRun?.requestFingerprint ?? `rerun:${meal.id}:${Date.now()}`,
      requestJson: latestRun?.requestJson ?? {
        contractVersion: 'meal-analysis-request-v1',
        rerunOfMealId: meal.id,
      },
    },
    select: {
      id: true,
    },
  });

  return executeMealAnalysisRun({
    userId,
    mealId: meal.id,
    analysisRunId: createdRun.id,
  });
}
