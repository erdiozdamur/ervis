import { randomUUID } from 'node:crypto';
import { getServerEnv } from '@/lib/env';
import type { MealAnalysisContext, MealAnalysisStage1Estimator, Stage1ItemFactoryInput } from '@/services/meal-analysis/contracts';
import { normalizeFoodQuery, parseTextIntoFoodSegments, suggestMealTypeFromConsumedAt } from '@/services/meal-analysis/heuristics';
import type { MealStage1EstimatedItem } from '@/types/meal-analysis';

function createEstimatedItem(input: Stage1ItemFactoryInput): MealStage1EstimatedItem {
  return {
    id: randomUUID(),
    displayName: input.displayName,
    normalizedQuery: input.normalizedQuery,
    quantityText: input.quantityText,
    quantityMultiplier: input.quantityMultiplier,
    sourceAssetIds: input.sourceAssetIds,
    confidence: input.confidence,
    unresolved: input.unresolved,
    reasoning: input.reasoning,
  };
}

function assetLabel(source: string | null, fallback: string) {
  if (!source) return fallback;
  if (source === 'camera') return 'Camera meal item';
  if (source === 'recording') return 'Voice note meal item';
  if (source === 'upload') return `Uploaded ${fallback.toLowerCase()} item`;
  return fallback;
}

function getImageFallbackPortionLabel(context: MealAnalysisContext, labelHint: string | null) {
  const normalizedHint = labelHint ? normalizeFoodQuery(labelHint) : '';

  if (/(ayran|kahve|cay|çay|latte|cappuccino|smoothie|juice|meyve suyu|milkshake)/.test(normalizedHint)) {
    return {
      quantityText: '1 bardak',
      quantityMultiplier: 1,
      displayName: 'Drink from photo',
    };
  }

  if (/(corba|çorba|soup|yogurt|yoğurt|oat|granola)/.test(normalizedHint)) {
    return {
      quantityText: '1 kase',
      quantityMultiplier: 1,
      displayName: 'Bowl item from photo',
    };
  }

  if (context.mealType === 'SNACK') {
    return {
      quantityText: '1 porsiyon',
      quantityMultiplier: 1,
      displayName: 'Snack item from photo',
    };
  }

  return {
    quantityText: '1 tabak',
    quantityMultiplier: 1,
    displayName: 'Plate item from photo',
  };
}

function parseStructuredTextItems(input: { textContent: string | null; assetId: string; confidence: number; reasoning: string }) {
  if (!input.textContent) {
    return [];
  }

  return parseTextIntoFoodSegments(input.textContent).map((segment) =>
    createEstimatedItem({
      displayName: segment.displayName,
      normalizedQuery: segment.normalizedQuery,
      quantityText: segment.quantityText,
      quantityMultiplier: segment.quantityMultiplier,
      sourceAssetIds: [input.assetId],
      confidence: input.confidence,
      unresolved: false,
      reasoning: input.reasoning,
    }),
  );
}

export class DefaultMealStage1Estimator implements MealAnalysisStage1Estimator {
  provider = 'heuristic-stage1';
  model = getServerEnv().MEAL_ANALYSIS_STAGE1_MODEL;

  async estimate(context: MealAnalysisContext) {
    const warnings: string[] = [];
    const estimatedItems: MealStage1EstimatedItem[] = [];

    for (const asset of context.assets) {
      if (asset.assetType === 'TEXT' && asset.textContent) {
        estimatedItems.push(
          ...parseStructuredTextItems({
            textContent: asset.textContent,
            assetId: asset.id,
            confidence: 0.9,
            reasoning: 'Derived directly from typed meal text, including quantity language when present.',
          }),
        );
      }

      if (asset.assetType === 'AUDIO' && asset.textContent) {
        estimatedItems.push(
          ...parseStructuredTextItems({
            textContent: asset.textContent,
            assetId: asset.id,
            confidence: 0.8,
            reasoning: 'Derived from an audio transcript and converted into reviewable food items.',
          }),
        );
      }

      if (asset.assetType === 'IMAGE') {
        warnings.push('Image-based stage 1 estimates stay draft-only and should be checked before final save.');
        const portionEstimate = getImageFallbackPortionLabel(context, asset.labelHint);

        estimatedItems.push(
          createEstimatedItem({
            displayName: asset.labelHint
              ? parseTextIntoFoodSegments(asset.labelHint.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))[0]?.displayName ??
                portionEstimate.displayName
              : portionEstimate.displayName,
            normalizedQuery: asset.labelHint
              ? parseTextIntoFoodSegments(asset.labelHint.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))[0]?.normalizedQuery ??
                normalizeFoodQuery(portionEstimate.displayName)
              : normalizeFoodQuery(portionEstimate.displayName),
            quantityText: portionEstimate.quantityText,
            quantityMultiplier: portionEstimate.quantityMultiplier,
            sourceAssetIds: [asset.id],
            confidence: asset.labelHint ? 0.56 : 0.44,
            unresolved: true,
            reasoning: asset.labelHint
              ? 'Estimated from the image asset label plus a conservative single-serving visual portion guess.'
              : 'Created as a conservative photo-based draft item with a plausible single-serving portion for later review.',
          }),
        );
      }

      if (asset.assetType === 'AUDIO') {
        if (!asset.textContent) {
          warnings.push('Audio-based items stay unresolved until a transcript is available or the user edits them.');
          estimatedItems.push(
            createEstimatedItem({
              displayName: assetLabel(asset.source, 'Audio meal item'),
              normalizedQuery: normalizeFoodQuery(assetLabel(asset.source, 'Audio meal item')),
              quantityText: '1 porsiyon',
              quantityMultiplier: 1,
              sourceAssetIds: [asset.id],
              confidence: 0.36,
              unresolved: true,
              reasoning: 'A voice note was attached without transcript text, so stage 1 created a conservative draft placeholder.',
            }),
          );
        }
      }
    }

    if (estimatedItems.length === 0) {
      warnings.push('No structured food estimate could be produced from the submitted inputs.');
      estimatedItems.push(
        createEstimatedItem({
          displayName: 'Unresolved meal item',
          normalizedQuery: 'unresolved meal item',
          quantityText: null,
          quantityMultiplier: 1,
          sourceAssetIds: context.assets.map((asset) => asset.id),
          confidence: 0.2,
          unresolved: true,
          reasoning: 'The intake did not contain enough structured detail to infer a clearer meal item.',
        }),
      );
    }

    const mealTypeSuggestion = suggestMealTypeFromConsumedAt(context.consumedAt);
    const mealTitleSuggestion = `${mealTypeSuggestion.charAt(0)}${mealTypeSuggestion.slice(1).toLowerCase()} draft`;

    return {
      stage: 'stage_1_estimation' as const,
      provider: this.provider,
      model: this.model,
      mealTypeSuggestion,
      mealTitleSuggestion,
      warnings,
      estimatedItems,
    };
  }
}
