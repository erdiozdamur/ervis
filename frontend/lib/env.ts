import { z } from 'zod';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  AUTH_TRUST_HOST: z.string().default('true'),
  AUTH_SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AI_PROVIDER: z.string().default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-mini-transcribe'),
  AI_ANALYSIS_PROMPT_VERSION: z.string().default('meal-intake-v1'),
  MEAL_ANALYSIS_STAGE1_MODEL: z.string().default('gpt-4.1-mini'),
  MEAL_ANALYSIS_STAGE2_MODEL: z.string().default('gpt-4.1-mini'),
  MEAL_ASSET_STORAGE_DRIVER: z.enum(['local']).default('local'),
  MEAL_ASSET_LOCAL_DIR: z.string().default('.uploads/meal-assets'),
  MEAL_ASSET_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(12),
  APP_TIME_ZONE: z.string().default(DEFAULT_APP_TIME_ZONE),
  TZ: z.string().default(DEFAULT_APP_TIME_ZONE),
});

const runtimeConfigBootstrapSchema = z.object({
  AI_PROVIDER: z.string().default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-mini-transcribe'),
  AI_ANALYSIS_PROMPT_VERSION: z.string().default('meal-intake-v1'),
  MEAL_ANALYSIS_STAGE1_MODEL: z.string().default('gpt-4.1-mini'),
  MEAL_ANALYSIS_STAGE2_MODEL: z.string().default('gpt-4.1-mini'),
  AI_FEATURE_IMAGE_ANALYSIS: z.coerce.boolean().default(true),
  AI_FEATURE_AUDIO_TRANSCRIPTION: z.coerce.boolean().default(true),
  AI_MAX_INPUT_ASSET_COUNT: z.coerce.number().int().positive().default(8),
  AI_MAX_TRANSCRIPT_CHARACTERS: z.coerce.number().int().positive().default(4000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type RuntimeConfigBootstrap = z.infer<typeof runtimeConfigBootstrapSchema>;
export type RuntimeEnvCheck = {
  databaseConfigured: boolean;
  authSecretConfigured: boolean;
  authUrlConfigured: boolean;
};

let cachedEnv: ServerEnv | null = null;
let cachedRuntimeBootstrap: RuntimeConfigBootstrap | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    AUTH_SESSION_MAX_AGE_DAYS: process.env.AUTH_SESSION_MAX_AGE_DAYS,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    AI_ANALYSIS_PROMPT_VERSION: process.env.AI_ANALYSIS_PROMPT_VERSION,
    MEAL_ANALYSIS_STAGE1_MODEL: process.env.MEAL_ANALYSIS_STAGE1_MODEL,
    MEAL_ANALYSIS_STAGE2_MODEL: process.env.MEAL_ANALYSIS_STAGE2_MODEL,
    MEAL_ASSET_STORAGE_DRIVER: process.env.MEAL_ASSET_STORAGE_DRIVER,
    MEAL_ASSET_LOCAL_DIR: process.env.MEAL_ASSET_LOCAL_DIR,
    MEAL_ASSET_MAX_FILE_SIZE_MB: process.env.MEAL_ASSET_MAX_FILE_SIZE_MB,
    APP_TIME_ZONE: process.env.APP_TIME_ZONE,
    TZ: process.env.TZ,
  });

  return cachedEnv;
}

export function getRuntimeConfigBootstrap(): RuntimeConfigBootstrap {
  if (cachedRuntimeBootstrap) {
    return cachedRuntimeBootstrap;
  }

  cachedRuntimeBootstrap = runtimeConfigBootstrapSchema.parse({
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    AI_ANALYSIS_PROMPT_VERSION: process.env.AI_ANALYSIS_PROMPT_VERSION,
    MEAL_ANALYSIS_STAGE1_MODEL: process.env.MEAL_ANALYSIS_STAGE1_MODEL,
    MEAL_ANALYSIS_STAGE2_MODEL: process.env.MEAL_ANALYSIS_STAGE2_MODEL,
    AI_FEATURE_IMAGE_ANALYSIS: process.env.AI_FEATURE_IMAGE_ANALYSIS,
    AI_FEATURE_AUDIO_TRANSCRIPTION: process.env.AI_FEATURE_AUDIO_TRANSCRIPTION,
    AI_MAX_INPUT_ASSET_COUNT: process.env.AI_MAX_INPUT_ASSET_COUNT,
    AI_MAX_TRANSCRIPT_CHARACTERS: process.env.AI_MAX_TRANSCRIPT_CHARACTERS,
  });

  return cachedRuntimeBootstrap;
}

export function getRuntimeEnvChecks(): RuntimeEnvCheck {
  const env = getServerEnv();

  return {
    databaseConfigured: Boolean(env.DATABASE_URL),
    authSecretConfigured: Boolean(env.AUTH_SECRET),
    authUrlConfigured: Boolean(env.NEXTAUTH_URL || env.NEXT_PUBLIC_APP_URL),
  };
}
