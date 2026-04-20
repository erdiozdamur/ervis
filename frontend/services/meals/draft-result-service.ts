import { prisma } from '@/db/prisma';
import { normalizeDraftResultTitle, normalizeMealTitleSuggestion } from '@/lib/meals/draft-title';
import { inferQuantityMultiplierFromText } from '@/lib/meals/draft-review';
import type {
  MealDraftAnalysisResult,
  MealDraftResultUpdateInput,
  MealStage2ResolvedItem,
  ResolvedNutritionMacros,
} from '@/types/meal-analysis';

type UpdateLatestOwnedMealDraftResultResult =
  | {
      ok: true;
      draftResult: MealDraftAnalysisResult;
    }
  | {
      ok: false;
      code: 'not_found' | 'conflict';
      message: string;
    };

function roundMacroValue(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeMacros(macros: ResolvedNutritionMacros): ResolvedNutritionMacros {
  return {
    calories: roundMacroValue(macros.calories),
    proteinGrams: roundMacroValue(macros.proteinGrams),
    carbGrams: roundMacroValue(macros.carbGrams),
    fatGrams: roundMacroValue(macros.fatGrams),
    fiberGrams: roundMacroValue(macros.fiberGrams),
  };
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return value == null ? null : roundMacroValue(value);
}

function equalDraftItem(left: MealStage2ResolvedItem, right: MealDraftResultUpdateInput['items'][number]) {
  return (
    left.displayName === right.displayName &&
    left.quantityText === right.quantityText &&
    left.gramsEstimate === right.gramsEstimate &&
    left.macros.calories === right.macros.calories &&
    left.macros.proteinGrams === right.macros.proteinGrams &&
    left.macros.carbGrams === right.macros.carbGrams &&
    left.macros.fatGrams === right.macros.fatGrams &&
    left.macros.fiberGrams === right.macros.fiberGrams
  );
}

export function sumDraftItemMacros(items: Array<Pick<MealStage2ResolvedItem, 'macros'>>) {
  return items.reduce<ResolvedNutritionMacros>(
    (totals, item) => ({
      calories: roundMacroValue(totals.calories + item.macros.calories),
      proteinGrams: roundMacroValue(totals.proteinGrams + item.macros.proteinGrams),
      carbGrams: roundMacroValue(totals.carbGrams + item.macros.carbGrams),
      fatGrams: roundMacroValue(totals.fatGrams + item.macros.fatGrams),
      fiberGrams: roundMacroValue(totals.fiberGrams + item.macros.fiberGrams),
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

export async function updateLatestOwnedMealDraftResult(
  userId: string,
  mealId: string,
  input: MealDraftResultUpdateInput,
): Promise<UpdateLatestOwnedMealDraftResultResult> {
  const latestRun = await prisma.mealAnalysisRun.findFirst({
    where: {
      mealId,
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      draftResultJson: true,
    },
  });

  if (!latestRun?.draftResultJson) {
    return {
      ok: false,
      code: 'not_found',
      message: 'No editable draft result was found for this meal.',
    };
  }

  const currentDraftResult = normalizeDraftResultTitle(latestRun.draftResultJson as MealDraftAnalysisResult);

  if (currentDraftResult.contractVersion !== 'meal-draft-result-v1') {
    return {
      ok: false,
      code: 'conflict',
      message: 'This draft result uses an unsupported contract version.',
    };
  }

  const inputItemsById = new Map(input.items.map((item) => [item.id, item]));
  const currentItemsById = new Map(currentDraftResult.items.map((item) => [item.id, item]));

  const updatedItems: MealStage2ResolvedItem[] = input.items.map((editableItem) => {
    const currentItem = currentItemsById.get(editableItem.id);

    if (currentItem && equalDraftItem(currentItem, editableItem)) {
      return currentItem;
    }

    return {
      id: editableItem.id,
      displayName: editableItem.displayName,
      normalizedQuery: editableItem.displayName.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(),
      quantityText: editableItem.quantityText,
      quantityMultiplier: inferQuantityMultiplierFromText(editableItem.quantityText),
      gramsEstimate: normalizeOptionalNumber(editableItem.gramsEstimate),
      sourceAssetIds: currentItem?.sourceAssetIds ?? [],
      confidence: 1,
      unresolved: false,
      reasoning: currentItem ? 'Adjusted during user review before save.' : 'Added during user review before save.',
      nutritionSource: 'USER_REVIEW',
      nutritionCacheEntryId: null,
      normalizedFoodEntryId: null,
      resolutionMetadata: {
        method: 'user_review',
        matchConfidence: 1,
        matchedKeyword: null,
      },
      macros: normalizeMacros(editableItem.macros),
    };
  });

  const updatedDraftResult: MealDraftAnalysisResult = {
    ...currentDraftResult,
    mealTypeSuggestion: input.mealTypeSuggestion,
    titleSuggestion: normalizeMealTitleSuggestion(input.titleSuggestion, input.mealTypeSuggestion),
    items: updatedItems,
    totals: sumDraftItemMacros(updatedItems),
  };

  await prisma.mealAnalysisRun.update({
    where: {
      id: latestRun.id,
    },
    data: {
      draftResultJson: updatedDraftResult,
    },
  });

  return {
    ok: true,
    draftResult: updatedDraftResult,
  };
}
