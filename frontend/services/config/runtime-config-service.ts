import type { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { getRuntimeConfigBootstrap } from '@/lib/env';

export type RuntimeConfig = {
  AI_PROVIDER: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_TRANSCRIPTION_MODEL: string;
  AI_ANALYSIS_PROMPT_VERSION: string;
  MEAL_ANALYSIS_STAGE1_MODEL: string;
  MEAL_ANALYSIS_STAGE2_MODEL: string;
  AI_FEATURE_IMAGE_ANALYSIS: boolean;
  AI_FEATURE_AUDIO_TRANSCRIPTION: boolean;
  AI_MAX_INPUT_ASSET_COUNT: number;
  AI_MAX_TRANSCRIPT_CHARACTERS: number;
};

export type RuntimeConfigKey = keyof RuntimeConfig;

type AppSettingType = 'string' | 'number' | 'boolean' | 'json';
type AppSettingScope = 'runtime.ai';

const RUNTIME_CONFIG_CACHE_TTL_MS = 60_000;

const runtimeConfigDefinitions: Record<RuntimeConfigKey, { type: AppSettingType; scope: AppSettingScope; isSecret: boolean }> = {
  AI_PROVIDER: { type: 'string', scope: 'runtime.ai', isSecret: false },
  OPENAI_API_KEY: { type: 'string', scope: 'runtime.ai', isSecret: true },
  OPENAI_MODEL: { type: 'string', scope: 'runtime.ai', isSecret: false },
  OPENAI_TRANSCRIPTION_MODEL: { type: 'string', scope: 'runtime.ai', isSecret: false },
  AI_ANALYSIS_PROMPT_VERSION: { type: 'string', scope: 'runtime.ai', isSecret: false },
  MEAL_ANALYSIS_STAGE1_MODEL: { type: 'string', scope: 'runtime.ai', isSecret: false },
  MEAL_ANALYSIS_STAGE2_MODEL: { type: 'string', scope: 'runtime.ai', isSecret: false },
  AI_FEATURE_IMAGE_ANALYSIS: { type: 'boolean', scope: 'runtime.ai', isSecret: false },
  AI_FEATURE_AUDIO_TRANSCRIPTION: { type: 'boolean', scope: 'runtime.ai', isSecret: false },
  AI_MAX_INPUT_ASSET_COUNT: { type: 'number', scope: 'runtime.ai', isSecret: false },
  AI_MAX_TRANSCRIPT_CHARACTERS: { type: 'number', scope: 'runtime.ai', isSecret: false },
};

let runtimeConfigCache: { value: RuntimeConfig; expiresAt: number } | null = null;

function coerceRuntimeValue(key: RuntimeConfigKey, value: unknown): string | number | boolean | undefined {
  const fallback = getRuntimeConfigBootstrap()[key];

  if (value === null || value === undefined) {
    return fallback;
  }

  switch (runtimeConfigDefinitions[key].type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : fallback;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    case 'string':
    default:
      return typeof value === 'string' ? value : fallback;
  }
}

function serializeRuntimeValue(value: string | number | boolean | undefined): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return '';
}

export function clearRuntimeConfigCache() {
  runtimeConfigCache = null;
}

export async function getRuntimeConfig(options?: { forceRefresh?: boolean }): Promise<RuntimeConfig> {
  if (!options?.forceRefresh && runtimeConfigCache && runtimeConfigCache.expiresAt > Date.now()) {
    return runtimeConfigCache.value;
  }

  const bootstrap = getRuntimeConfigBootstrap();
  const value: RuntimeConfig = { ...bootstrap };
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  if (!hasDatabaseUrl) {
    runtimeConfigCache = { value, expiresAt: Date.now() + RUNTIME_CONFIG_CACHE_TTL_MS };
    return value;
  }

  const rows = await prisma.appSetting
    .findMany({
      where: { key: { in: Object.keys(runtimeConfigDefinitions) } },
      select: { key: true, valueJson: true },
    })
    .catch(() => []);

  for (const row of rows) {
    const key = row.key as RuntimeConfigKey;
    if (!(key in runtimeConfigDefinitions)) continue;

    (value as Record<string, unknown>)[key] = coerceRuntimeValue(key, row.valueJson);
  }

  runtimeConfigCache = { value, expiresAt: Date.now() + RUNTIME_CONFIG_CACHE_TTL_MS };
  return value;
}

export async function updateRuntimeConfig(input: { patch: Partial<RuntimeConfig>; updatedBy?: string | null }) {
  const now = new Date();
  const updates = Object.entries(input.patch).filter(([key]) => key in runtimeConfigDefinitions) as Array<[RuntimeConfigKey, unknown]>;

  await prisma.$transaction(
    updates.map(([key, rawValue]) => {
      const normalizedValue = coerceRuntimeValue(key, rawValue);
      const definition = runtimeConfigDefinitions[key];

      return prisma.appSetting.upsert({
        where: { key },
        create: {
          key,
          valueJson: serializeRuntimeValue(normalizedValue),
          type: definition.type,
          scope: definition.scope,
          isSecret: definition.isSecret,
          updatedBy: input.updatedBy ?? null,
          updatedAt: now,
        },
        update: {
          valueJson: serializeRuntimeValue(normalizedValue),
          type: definition.type,
          scope: definition.scope,
          isSecret: definition.isSecret,
          updatedBy: input.updatedBy ?? null,
          updatedAt: now,
        },
      });
    }),
  );

  clearRuntimeConfigCache();
  return getRuntimeConfig({ forceRefresh: true });
}
