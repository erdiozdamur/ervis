import { z } from 'zod';

const namespaceSchema = z.enum(['ai', 'app', 'feature']);

const appNameValueSchema = z.object({
  name: z.string().min(1),
});

const appSupportEmailValueSchema = z.object({
  email: z.string().email(),
});

const aiMealModelValueSchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
});

const featureMealDraftReviewValueSchema = z.object({
  enabled: z.boolean(),
  rolloutPercentage: z.number().int().min(0).max(100),
});

export const appMetaRegistry = {
  'app.name': {
    namespace: 'app',
    key: 'name',
    valueSchema: appNameValueSchema,
    jsonSchema: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1 },
      },
    },
  },
  'app.supportEmail': {
    namespace: 'app',
    key: 'supportEmail',
    valueSchema: appSupportEmailValueSchema,
    jsonSchema: {
      type: 'object',
      required: ['email'],
      additionalProperties: false,
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
  },
  'ai.mealModel': {
    namespace: 'ai',
    key: 'mealModel',
    valueSchema: aiMealModelValueSchema,
    jsonSchema: {
      type: 'object',
      required: ['model', 'temperature'],
      additionalProperties: false,
      properties: {
        model: { type: 'string', minLength: 1 },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
      },
    },
  },
  'feature.mealDraftReview': {
    namespace: 'feature',
    key: 'mealDraftReview',
    valueSchema: featureMealDraftReviewValueSchema,
    jsonSchema: {
      type: 'object',
      required: ['enabled', 'rolloutPercentage'],
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        rolloutPercentage: { type: 'integer', minimum: 0, maximum: 100 },
      },
    },
  },
} as const;

export type AppMetaKey = keyof typeof appMetaRegistry;

type Registry = typeof appMetaRegistry;
type RegistryValueSchema<K extends AppMetaKey> = Registry[K]['valueSchema'];

export type AppMetaValue<K extends AppMetaKey> = z.infer<RegistryValueSchema<K>>;

export const appMetaVersionSchema = z.object({
  version: z.number().int().positive(),
  publishedAt: z.coerce.date(),
  publishedBy: z.string().min(1),
});

export type AppMetaVersion = z.infer<typeof appMetaVersionSchema>;

export function validateAppMetaKey(key: string): key is AppMetaKey {
  return key in appMetaRegistry;
}

export function validateAppMetaRecord<K extends AppMetaKey>(
  key: K,
  value: unknown,
  versioning: unknown,
): { namespace: Registry[K]['namespace']; key: Registry[K]['key']; value: AppMetaValue<K>; versioning: AppMetaVersion } {
  const registryEntry = appMetaRegistry[key];
  const namespace = namespaceSchema.parse(registryEntry.namespace) as Registry[K]['namespace'];
  const parsedValue = registryEntry.valueSchema.parse(value) as AppMetaValue<K>;
  const parsedVersioning = appMetaVersionSchema.parse(versioning);

  return {
    namespace,
    key: registryEntry.key,
    value: parsedValue,
    versioning: parsedVersioning,
  };
}
