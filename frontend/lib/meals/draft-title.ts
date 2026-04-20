import type { MealType } from '@prisma/client';
import type { MealDraftAnalysisResult } from '@/types/meal-analysis';

export function getDefaultMealTitleSuggestion(mealType: MealType) {
  switch (mealType) {
    case 'BREAKFAST':
      return 'Kahvaltı';
    case 'LUNCH':
      return 'Öğle yemeği';
    case 'DINNER':
      return 'Akşam yemeği';
    case 'SNACK':
      return 'Ara öğün';
    default:
      return 'Öğün';
  }
}

export function normalizeMealTitleSuggestion(titleSuggestion: string | null | undefined, mealType: MealType) {
  const normalized = titleSuggestion?.trim();

  if (!normalized) {
    return getDefaultMealTitleSuggestion(mealType);
  }

  const lower = normalized.toLocaleLowerCase('tr-TR');

  if (
    lower === 'dinner draft' ||
    lower === 'akşam taslağı' ||
    lower === 'dinner' ||
    lower === 'akşam'
  ) {
    return 'Akşam yemeği';
  }

  if (
    lower === 'lunch draft' ||
    lower === 'öğle taslağı' ||
    lower === 'lunch' ||
    lower === 'öğle'
  ) {
    return 'Öğle yemeği';
  }

  if (
    lower === 'breakfast draft' ||
    lower === 'kahvaltı taslağı' ||
    lower === 'breakfast'
  ) {
    return 'Kahvaltı';
  }

  if (
    lower === 'snack draft' ||
    lower === 'ara öğün taslağı' ||
    lower === 'atıştırma taslağı' ||
    lower === 'snack' ||
    lower === 'atıştırma'
  ) {
    return 'Ara öğün';
  }

  return normalized;
}

export function normalizeDraftResultTitle<T extends Pick<MealDraftAnalysisResult, 'titleSuggestion' | 'mealTypeSuggestion'>>(
  draftResult: T,
) {
  return {
    ...draftResult,
    titleSuggestion: normalizeMealTitleSuggestion(draftResult.titleSuggestion, draftResult.mealTypeSuggestion),
  };
}
