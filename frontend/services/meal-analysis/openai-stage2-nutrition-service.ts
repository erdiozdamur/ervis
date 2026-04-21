import { getRuntimeConfig } from '@/services/config/runtime-config-service';
import { readMealAssetFile } from '@/lib/storage/meal-asset-storage';
import { localizeFoodDisplayName } from '@/services/meal-analysis/heuristics';
import { extractResponseDiagnostics, extractStructuredOutputData } from '@/services/meal-analysis/openai-structured-output';
import {
  getActivePromptTemplate,
  PROMPT_TEMPLATE_KEYS,
  renderPromptTemplate,
} from '@/services/meal-analysis/prompt-template-service';
import type { MealAnalysisAssetInput, ResolvedNutritionMacros } from '@/types/meal-analysis';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_IMAGE_CONTEXT_ASSETS = 2;

type OpenAiResolvedNutrition = {
  canonicalName: string;
  servingSummary: string;
  gramsEstimate: number;
  confidence: number;
  reasoning: string;
  macros: ResolvedNutritionMacros;
  diagnostics: {
    responseId: string | null;
    responseStatus: string | null;
    structuredOutputFound: boolean;
    outputTextPreview: string | null;
  };
};

type OpenAiResolutionInput = {
  item: {
    displayName: string;
    normalizedQuery: string;
    quantityText: string | null;
    quantityMultiplier: number;
    reasoning: string;
  };
  mealContext: {
    mealType: string;
    consumedAtIso: string;
    textContext: string[];
    sourceAssets: MealAnalysisAssetInput[];
  };
};

function looksLikeGenericPhotoPlaceholder(value: string) {
  const normalized = value
    .toLocaleLowerCase('tr-TR')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    normalized === 'fotoğraftaki öğün' ||
    normalized === 'fotoğraftaki tabak' ||
    normalized === 'fotoğraftaki kase' ||
    normalized === 'fotoğraftaki içecek' ||
    normalized === 'fotoğraftaki atıştırmalık'
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10;
}

function createStructuredOutputSchema() {
  return {
    type: 'json_schema',
    name: 'meal_stage2_nutrition_resolution',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['canonicalName', 'servingSummary', 'gramsEstimate', 'confidence', 'reasoning', 'macros'],
      properties: {
        canonicalName: {
          type: 'string',
          minLength: 1,
          maxLength: 120,
        },
        servingSummary: {
          type: 'string',
          minLength: 1,
          maxLength: 120,
        },
        gramsEstimate: {
          type: 'number',
          minimum: 0,
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        reasoning: {
          type: 'string',
          minLength: 1,
          maxLength: 400,
        },
        macros: {
          type: 'object',
          additionalProperties: false,
          required: ['calories', 'proteinGrams', 'carbGrams', 'fatGrams', 'fiberGrams'],
          properties: {
            calories: {
              type: 'number',
              minimum: 0,
            },
            proteinGrams: {
              type: 'number',
              minimum: 0,
            },
            carbGrams: {
              type: 'number',
              minimum: 0,
            },
            fatGrams: {
              type: 'number',
              minimum: 0,
            },
            fiberGrams: {
              type: 'number',
              minimum: 0,
            },
          },
        },
      },
    },
  } as const;
}

export function parseStructuredNutritionPayload(payload: unknown): OpenAiResolvedNutrition {
  const diagnostics = extractResponseDiagnostics(payload);
  const data = extractStructuredOutputData(payload);
  const macros = data.macros && typeof data.macros === 'object' ? (data.macros as Record<string, unknown>) : null;

  if (!macros) {
    throw new Error('The nutrition model response did not include macros.');
  }

  const parsed = {
    canonicalName: localizeFoodDisplayName(
      typeof data.canonicalName === 'string' && data.canonicalName.trim() ? data.canonicalName.trim() : 'Çözümlenen besin',
    ),
    servingSummary:
      typeof data.servingSummary === 'string' && data.servingSummary.trim() ? data.servingSummary.trim() : '1 serving',
    gramsEstimate: typeof data.gramsEstimate === 'number' ? Math.max(0, data.gramsEstimate) : 0,
    confidence: clamp(typeof data.confidence === 'number' ? data.confidence : 0.5, 0, 1),
    reasoning:
      typeof data.reasoning === 'string' && data.reasoning.trim()
        ? data.reasoning.trim()
        : 'Resolved from the nutrition model response.',
    macros: {
      calories: roundMacro(typeof macros.calories === 'number' ? macros.calories : 0),
      proteinGrams: roundMacro(typeof macros.proteinGrams === 'number' ? macros.proteinGrams : 0),
      carbGrams: roundMacro(typeof macros.carbGrams === 'number' ? macros.carbGrams : 0),
      fatGrams: roundMacro(typeof macros.fatGrams === 'number' ? macros.fatGrams : 0),
      fiberGrams: roundMacro(typeof macros.fiberGrams === 'number' ? macros.fiberGrams : 0),
    },
    diagnostics,
  };

  if (parsed.macros.calories <= 0) {
    throw new Error('The nutrition model response returned a non-positive calorie estimate.');
  }

  return parsed;
}

function buildUserPrompt(input: OpenAiResolutionInput, template: string) {
  const textContext =
    input.mealContext.textContext.length > 0
      ? input.mealContext.textContext.map((entry, index) => `${index + 1}. ${entry}`).join('\n')
      : 'No transcript or typed context was available.';
  const itemKind = looksLikeGenericPhotoPlaceholder(input.item.displayName) ? 'generic_photo_placeholder' : 'named_food_item';

  const rendered = renderPromptTemplate(
    {
      id: 'inline',
      key: PROMPT_TEMPLATE_KEYS.stage2NutritionResolver,
      version: 'inline',
      locale: 'tr-TR',
      systemInstructions: '',
      userTemplate: template,
      source: 'default',
    },
    {
      mealType: input.mealContext.mealType,
      consumedAtIso: input.mealContext.consumedAtIso,
      itemKind,
      displayName: input.item.displayName,
      normalizedQuery: input.item.normalizedQuery,
      quantityText: input.item.quantityText ?? 'none',
      quantityMultiplier: input.item.quantityMultiplier,
      reasoning: input.item.reasoning,
      textContext,
    },
  );

  return rendered.userPrompt;
}

async function buildImageContentParts(sourceAssets: MealAnalysisAssetInput[]) {
  const imageAssets = sourceAssets.filter((asset) => asset.assetType === 'IMAGE' && asset.storageKey && asset.mimeType).slice(0, MAX_IMAGE_CONTEXT_ASSETS);
  const contentParts: Array<{ type: 'input_image'; image_url: string }> = [];

  for (const asset of imageAssets) {
    const buffer = await readMealAssetFile(asset.storageKey as string).catch(() => null);

    if (!buffer) {
      continue;
    }

    const mimeType = asset.mimeType || 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    contentParts.push({
      type: 'input_image',
      image_url: imageUrl,
    });
  }

  return contentParts;
}

export async function resolveNutritionWithOpenAi(input: OpenAiResolutionInput): Promise<OpenAiResolvedNutrition> {
  const runtimeConfig = await getRuntimeConfig();

  if (runtimeConfig.AI_PROVIDER !== 'openai' || !runtimeConfig.AI_FEATURE_IMAGE_ANALYSIS) {
    throw new Error('OpenAI nutrition resolution is disabled because AI_PROVIDER is not set to openai.');
  }

  if (!runtimeConfig.OPENAI_API_KEY) {
    throw new Error('OpenAI nutrition resolution is not configured because OPENAI_API_KEY is missing.');
  }

  const promptTemplate = await getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage2NutritionResolver);

  const userContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string }> = [
    {
      type: 'input_text',
      text: buildUserPrompt(input, promptTemplate.userTemplate),
    },
  ];

  userContent.push(...(await buildImageContentParts(input.mealContext.sourceAssets)));

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtimeConfig.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.MEAL_ANALYSIS_STAGE2_MODEL,
      instructions: promptTemplate.systemInstructions,
      input: [
        {
          role: 'user',
          content: userContent,
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
        : 'The nutrition model request failed.';

    throw new Error(apiError);
  }

  return parseStructuredNutritionPayload(payload);
}
