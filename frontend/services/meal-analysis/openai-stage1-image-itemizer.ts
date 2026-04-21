import { getRuntimeConfig } from '@/services/config/runtime-config-service';
import { readMealAssetFile } from '@/lib/storage/meal-asset-storage';
import { localizeFoodDisplayName } from '@/services/meal-analysis/heuristics';
import { extractResponseDiagnostics, extractStructuredOutputData } from '@/services/meal-analysis/openai-structured-output';
import {
  getActivePromptTemplate,
  PROMPT_TEMPLATE_KEYS,
  renderPromptTemplate,
} from '@/services/meal-analysis/prompt-template-service';
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
  diagnostics: {
    responseId: string | null;
    responseStatus: string | null;
    structuredOutputFound: boolean;
    outputTextPreview: string | null;
    rawItemCount: number;
    retryTriggered: boolean;
    retryUsed: boolean;
  };
};

type Stage1RuleConfig = AnalysisRuleSet['stage1'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeImageItemName(value: string) {
  return value.toLocaleLowerCase('tr-TR').trim();
}

function inferCompositeDishName(items: Stage1ImageItem[], labelHint: string | null, rules: Stage1RuleConfig) {
  const normalizedLabelHint = labelHint ? normalizeImageItemName(labelHint) : '';
  const normalizedItems = items.map((item) => normalizeImageItemName(item.displayName));

  for (const rule of rules.compositeDishRules.filter((candidate) => candidate.enabled)) {
    const hintMatches = rule.dishKeywords.some((keyword) => normalizedLabelHint.includes(keyword));
    const matchingComponents = normalizedItems.filter((itemName) =>
      rule.componentKeywords.some((keyword) => itemName.includes(keyword)),
    );

    if (hintMatches && matchingComponents.length >= 2) {
      return rule.dishName;
    }

    if (normalizedItems.length >= 2 && normalizedItems.every((itemName) => rule.componentKeywords.some((keyword) => itemName.includes(keyword)))) {
      return rule.dishName;
    }
  }

  return null;
}

export function applyImageItemizationPostProcessing(
  items: Stage1ImageItem[],
  labelHint: string | null,
  rules: Stage1RuleConfig = getDefaultAnalysisRules().stage1,
): Stage1ImageItem[] {
  if (items.length <= 1) {
    return items;
  }

  const compositeDishName = inferCompositeDishName(items, labelHint, rules);
  if (!compositeDishName) {
    return items;
  }

  const averageConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;

  return [
    {
      displayName: compositeDishName,
      quantityText: '1 porsiyon',
      quantityMultiplier: 1,
      confidence: clamp(averageConfidence, 0, 1),
      reasoning: `${compositeDishName} birleşik bir yemek olarak değerlendirildi, malzemeler ayrı öğelere bölünmedi.`,
    },
  ];
}

export function looksLikeSeparatedPlatterLabel(displayName: string, rules: Stage1RuleConfig = getDefaultAnalysisRules().stage1) {
  const normalized = normalizeImageItemName(displayName);
  return rules.platterKeywords.some((keyword) => normalized.includes(normalizeImageItemName(keyword)));
}

async function requestImageItemization(input: {
  asset: MealAnalysisAssetInput;
  mealContext: {
    mealType: string;
    consumedAtIso: string;
  };
  instructions: string;
  userPrompt: string;
}) {
  const runtimeConfig = await getRuntimeConfig();

  if (runtimeConfig.AI_PROVIDER !== 'openai' || !runtimeConfig.AI_FEATURE_IMAGE_ANALYSIS) {
    throw new Error('OpenAI stage 1 image itemization is disabled because AI_PROVIDER is not set to openai.');
  }

  if (!runtimeConfig.OPENAI_API_KEY) {
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
      Authorization: `Bearer ${runtimeConfig.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.MEAL_ANALYSIS_STAGE1_MODEL,
      instructions: input.instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: input.userPrompt,
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

function createStructuredOutputSchema() {
  return {
    type: 'json_schema',
    name: 'meal_stage1_image_itemization',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'warning'],
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
          type: ['string', 'null'],
          maxLength: 240,
        },
      },
    },
  } as const;
}

export function parseStructuredPayload(payload: unknown): OpenAiImageItemizationResult {
  const diagnostics = extractResponseDiagnostics(payload);
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
    diagnostics: {
      ...diagnostics,
      rawItemCount: rawItems.length,
      retryTriggered: false,
      retryUsed: false,
    },
  };
}

export async function extractMealItemsFromImageWithOpenAi(input: {
  asset: MealAnalysisAssetInput;
  mealContext: {
    mealType: string;
    consumedAtIso: string;
  };
}): Promise<OpenAiImageItemizationResult> {
  const [primaryTemplate, retryTemplate] = await Promise.all([
    getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage1ImageItemizerPrimary),
    getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage1ImageItemizerRetry),
  ]);

  const primaryPrompt = renderPromptTemplate(primaryTemplate, {
    mealType: input.mealContext.mealType,
    consumedAtIso: input.mealContext.consumedAtIso,
    labelHint: input.asset.labelHint ?? 'none',
  });

  const primaryResult = await requestImageItemization({
    asset: input.asset,
    mealContext: input.mealContext,
    instructions: primaryPrompt.instructions,
    userPrompt: primaryPrompt.userPrompt,
  });

  const postProcessedPrimaryItems = applyImageItemizationPostProcessing(primaryResult.items, input.asset.labelHint, ruleSnapshot.rules.stage1);

  if (postProcessedPrimaryItems.length === 1 && postProcessedPrimaryItems[0] && looksLikeSeparatedPlatterLabel(postProcessedPrimaryItems[0].displayName)) {
    const retryPrompt = renderPromptTemplate(retryTemplate, {
      mealType: input.mealContext.mealType,
      consumedAtIso: input.mealContext.consumedAtIso,
      labelHint: input.asset.labelHint ?? 'none',
    });

    const retryResult = await requestImageItemization({
      asset: input.asset,
      mealContext: input.mealContext,
      instructions: retryPrompt.instructions,
      userPrompt: retryPrompt.userPrompt,
    });

    const retryItems = applyImageItemizationPostProcessing(retryResult.items, input.asset.labelHint, ruleSnapshot.rules.stage1);
    if (retryItems.length > 1) {
      return {
        warning: retryResult.warning,
        items: retryItems,
        diagnostics: {
          ...retryResult.diagnostics,
          retryTriggered: true,
          retryUsed: true,
        },
      };
    }
  }

  return {
    ...primaryResult,
    items: postProcessedPrimaryItems,
    diagnostics: {
      ...primaryResult.diagnostics,
      retryTriggered:
        postProcessedPrimaryItems.length === 1 &&
        Boolean(postProcessedPrimaryItems[0]) &&
        looksLikeSeparatedPlatterLabel(postProcessedPrimaryItems[0].displayName, ruleSnapshot.rules.stage1),
      retryUsed: false,
    },
  };
}
