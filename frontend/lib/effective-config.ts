import { prisma } from '@/db/prisma';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getServerEnv } from '@/lib/env';

type EffectiveConfig = {
  aiProvider: string;
  aiAnalysisPromptVersion: string;
  mealAnalysisStage1Model: string;
  mealAnalysisStage2Model: string;
  mealAssetMaxFileSizeMb: number;
  appTimeZone: string;
};

type PublishedConfigMap = Map<string, unknown>;

const defaultEffectiveConfig: EffectiveConfig = {
  aiProvider: 'openai',
  aiAnalysisPromptVersion: 'meal-intake-v1',
  mealAnalysisStage1Model: 'gpt-4.1-mini',
  mealAnalysisStage2Model: 'gpt-4.1-mini',
  mealAssetMaxFileSizeMb: 12,
  appTimeZone: DEFAULT_APP_TIME_ZONE,
};

let cachedEffectiveConfig: EffectiveConfig | null = null;

function getStringRecordValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
}

function getNumberRecordValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function getPublishedConfigValue(map: PublishedConfigMap, fullKey: string) {
  return map.get(fullKey) ?? null;
}

async function loadPublishedConfigMap(): Promise<PublishedConfigMap> {
  const map: PublishedConfigMap = new Map();
  const env = getServerEnv();

  if (!env.DATABASE_URL) {
    return map;
  }

  try {
    const rows = await prisma.appMeta.findMany({
      where: {
        OR: [
          { namespace: 'ai', key: 'mealModel' },
          { namespace: 'ai', key: 'provider' },
          { namespace: 'ai', key: 'analysisPromptVersion' },
          { namespace: 'app', key: 'timeZone' },
          { namespace: 'app', key: 'uploadValidation' },
        ],
      },
      orderBy: {
        publishedAt: 'desc',
      },
      select: {
        namespace: true,
        key: true,
        valueJson: true,
      },
    });

    for (const row of rows) {
      map.set(`${row.namespace}.${row.key}`, row.valueJson);
    }
  } catch {
    return map;
  }

  return map;
}

export async function getEffectiveConfig(): Promise<EffectiveConfig> {
  if (cachedEffectiveConfig) {
    return cachedEffectiveConfig;
  }

  const env = getServerEnv();
  const publishedConfig = await loadPublishedConfigMap();

  const publishedMealModel = getStringRecordValue(getPublishedConfigValue(publishedConfig, 'ai.mealModel'), 'model');
  const publishedAiProvider = getStringRecordValue(getPublishedConfigValue(publishedConfig, 'ai.provider'), 'provider');
  const publishedPromptVersion = getStringRecordValue(
    getPublishedConfigValue(publishedConfig, 'ai.analysisPromptVersion'),
    'version',
  );
  const publishedTimeZone = getStringRecordValue(getPublishedConfigValue(publishedConfig, 'app.timeZone'), 'timeZone');
  const publishedMaxFileSizeMb = getNumberRecordValue(
    getPublishedConfigValue(publishedConfig, 'app.uploadValidation'),
    'maxFileSizeMb',
  );

  cachedEffectiveConfig = {
    mealAnalysisStage1Model: publishedMealModel ?? env.MEAL_ANALYSIS_STAGE1_MODEL ?? defaultEffectiveConfig.mealAnalysisStage1Model,
    mealAnalysisStage2Model: publishedMealModel ?? env.MEAL_ANALYSIS_STAGE2_MODEL ?? defaultEffectiveConfig.mealAnalysisStage2Model,
    aiProvider: publishedAiProvider ?? env.AI_PROVIDER ?? defaultEffectiveConfig.aiProvider,
    aiAnalysisPromptVersion:
      publishedPromptVersion ?? env.AI_ANALYSIS_PROMPT_VERSION ?? defaultEffectiveConfig.aiAnalysisPromptVersion,
    mealAssetMaxFileSizeMb:
      publishedMaxFileSizeMb ?? env.MEAL_ASSET_MAX_FILE_SIZE_MB ?? defaultEffectiveConfig.mealAssetMaxFileSizeMb,
    appTimeZone: publishedTimeZone ?? env.APP_TIME_ZONE ?? defaultEffectiveConfig.appTimeZone,
  };

  return cachedEffectiveConfig;
}
