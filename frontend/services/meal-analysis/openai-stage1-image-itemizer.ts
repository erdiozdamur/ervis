import { getServerEnv } from '@/lib/env';
import { readMealAssetFile } from '@/lib/storage/meal-asset-storage';
import { localizeFoodDisplayName } from '@/services/meal-analysis/heuristics';
import { extractStructuredOutputData } from '@/services/meal-analysis/openai-structured-output';
import type { MealAnalysisAssetInput } from '@/types/meal-analysis';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type Stage1ImageItem = {
  displayName: string;
  quantityText: string | null;
  quantityMultiplier: number;
  confidence: number;
  reasoning: string;
};

type OpenAiImageItemizationResult = {
  items: Stage1ImageItem[];
  warning?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createStructuredOutputSchema() {
  return {
    type: 'json_schema',
    name: 'meal_stage1_image_itemization',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          minItems: 0,
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['displayName', 'quantityText', 'quantityMultiplier', 'confidence', 'reasoning'],
            properties: {
              displayName: {
                type: 'string',
                minLength: 1,
                maxLength: 120,
              },
              quantityText: {
                type: ['string', 'null'],
                maxLength: 60,
              },
              quantityMultiplier: {
                type: 'number',
                minimum: 0.05,
                maximum: 15,
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
              reasoning: {
                type: 'string',
                minLength: 1,
                maxLength: 240,
              },
            },
          },
        },
        warning: {
          type: 'string',
          minLength: 1,
          maxLength: 240,
        },
      },
    },
  } as const;
}

export function parseStructuredPayload(payload: unknown): OpenAiImageItemizationResult {
  const data = extractStructuredOutputData(payload);
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: Stage1ImageItem[] = rawItems
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const row = entry as Record<string, unknown>;
      const rawDisplayName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
      const displayName = rawDisplayName ? localizeFoodDisplayName(rawDisplayName) : '';
      if (!displayName) {
        return [];
      }

      const quantityText = typeof row.quantityText === 'string' ? row.quantityText.trim() : null;
      const quantityMultiplier = typeof row.quantityMultiplier === 'number' && Number.isFinite(row.quantityMultiplier) ? row.quantityMultiplier : 1;
      const confidence = typeof row.confidence === 'number' && Number.isFinite(row.confidence) ? row.confidence : 0.5;
      const reasoning =
        typeof row.reasoning === 'string' && row.reasoning.trim() ? row.reasoning.trim() : 'Fotoğraftan tahmini öğe çıkarımı yapıldı.';

      return [
        {
          displayName,
          quantityText: quantityText && quantityText.length > 0 ? quantityText : null,
          quantityMultiplier: clamp(quantityMultiplier, 0.05, 15),
          confidence: clamp(confidence, 0, 1),
          reasoning,
        },
      ];
    })
    .slice(0, 8);

  const warning = typeof data.warning === 'string' && data.warning.trim() ? data.warning.trim() : undefined;

  return {
    items,
    warning,
  };
}

export async function extractMealItemsFromImageWithOpenAi(input: {
  asset: MealAnalysisAssetInput;
  mealContext: {
    mealType: string;
    consumedAtIso: string;
  };
}): Promise<OpenAiImageItemizationResult> {
  const env = getServerEnv();

  if (env.AI_PROVIDER !== 'openai') {
    throw new Error('OpenAI stage 1 image itemization is disabled because AI_PROVIDER is not set to openai.');
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI stage 1 image itemization is not configured because OPENAI_API_KEY is missing.');
  }

  if (!input.asset.storageKey) {
    throw new Error('Image asset storage key is missing.');
  }

  const buffer = await readMealAssetFile(input.asset.storageKey);
  const mimeType = input.asset.mimeType || 'image/jpeg';
  const imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.MEAL_ANALYSIS_STAGE1_MODEL,
      instructions: [
        'You are a food-item detector for a Turkish calorie tracking app.',
        'Identify distinct foods visible in the photo as separate list entries.',
        'Use Turkish display names.',
        'Do not include file names, camera labels, or generic placeholders.',
        'Estimate practical single-person quantities for home/restaurant portions.',
        'quantityMultiplier must be a serving-scale number (e.g. 1, 0.5, 1.5, 2).',
        'For mixed plates, split into clear components like pilav, et, yoğurt, sebze.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Meal type: ${input.mealContext.mealType}`,
                `Consumed at: ${input.mealContext.consumedAtIso}`,
                `Asset label hint: ${input.asset.labelHint ?? 'none'}`,
              ].join('\n'),
            },
            {
              type: 'input_image',
              image_url: imageUrl,
            },
          ],
        },
      ],
      text: {
        format: createStructuredOutputSchema(),
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const apiError =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : 'The stage 1 image itemizer request failed.';

    throw new Error(apiError);
  }

  return parseStructuredPayload(payload);
}
