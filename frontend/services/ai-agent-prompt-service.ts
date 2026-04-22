import { prisma } from '@/db/prisma';

type AppMetaColumnSet = {
  hasNamespace: boolean;
  hasValue: boolean;
  hasValueJson: boolean;
};

let appMetaColumnSetPromise: Promise<AppMetaColumnSet> | null = null;

async function getAppMetaColumnSet(): Promise<AppMetaColumnSet> {
  if (appMetaColumnSetPromise) {
    return appMetaColumnSetPromise;
  }

  appMetaColumnSetPromise = prisma
    .$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'AppMeta'
    `
    .then((rows) => {
      const names = new Set(rows.map((row) => row.column_name));
      return {
        hasNamespace: names.has('namespace'),
        hasValue: names.has('value'),
        hasValueJson: names.has('valueJson'),
      };
    })
    .catch(() => ({
      hasNamespace: false,
      hasValue: true,
      hasValueJson: false,
    }));

  return appMetaColumnSetPromise;
}

export type AgentPromptDefinition = {
  key: string;
  agent: string;
  scope: string;
  modelEnvKey: 'MEAL_ANALYSIS_STAGE1_MODEL' | 'MEAL_ANALYSIS_STAGE2_MODEL';
  defaultText: string;
};

const PROMPT_KEY_PREFIX = 'agent_prompt:';
const PROMPT_NAMESPACE = 'agent_prompt';

export const AGENT_PROMPT_DEFINITIONS: AgentPromptDefinition[] = [
  {
    key: 'meal_analysis_stage1_primary',
    agent: 'Meal Analyzer Agent',
    scope: 'Yemek görselinden öğe ayıklama',
    modelEnvKey: 'MEAL_ANALYSIS_STAGE1_MODEL',
    defaultText: [
      'You are a food-item detector for a Turkish calorie tracking app.',
      'Identify distinct foods visible in the photo as separate list entries.',
      'Use Turkish display names.',
      'Do not include file names, camera labels, or generic placeholders.',
      'Estimate practical single-person quantities for home/restaurant portions.',
      'quantityMultiplier must be a serving-scale number (e.g. 1, 0.5, 1.5, 2).',
      'Split only foods that are physically separate and separately served on the plate.',
      'Do not split a single mixed dish or cooked combined dish into ingredients.',
      'If there are clearly visible separate sections on one plate, return multiple items rather than one umbrella plate label.',
      'If you can see several mezes, side dishes, pastries, desserts, or salad portions on one plate, list each visible section separately.',
      'Only return zero items when no edible food is visible or the image is too unclear to identify any food at all.',
      'For example: pilav + tas kebabı + patates kızartması should be separate items.',
      'For example: kısır + yaprak sarma + Rus salatası + poğaça + tatlı on one plate should be separate items.',
      'For example: karnıyarık, musakka, mantı, çorba, burger, sandviç should each stay as one item.',
    ].join(' '),
  },
  {
    key: 'meal_analysis_stage1_platter_retry',
    agent: 'Meal Analyzer Agent',
    scope: 'Karışık tabak yeniden ayrıştırma',
    modelEnvKey: 'MEAL_ANALYSIS_STAGE1_MODEL',
    defaultText: [
      'You are separating a platter into distinct foods for a Turkish calorie tracking app.',
      'Return separate foods only when they are visibly distinct and separately served on the same plate.',
      'Do not return one umbrella label such as meze tabağı, karışık tabak, mixed plate, platter, or breakfast plate.',
      'Name each visible component separately in Turkish.',
      'If the image shows kısır, yaprak sarma, Rus salatası, börek, tatlı gibi ayrı bölümler, list them as separate items.',
      'If there are 3 or more clearly distinct food sections, return them separately instead of one combined answer.',
      'Do not split a single cooked mixed dish into ingredients.',
    ].join(' '),
  },
  {
    key: 'meal_analysis_stage2_nutrition',
    agent: 'Nutrition Resolver Agent',
    scope: 'Tek öğe için makro ve kalori tahmini',
    modelEnvKey: 'MEAL_ANALYSIS_STAGE2_MODEL',
    defaultText: [
      'You are resolving nutrition for a mobile calorie tracking app.',
      'Return nutrition for exactly one reviewable meal item.',
      'Be practical and realistic for Turkish daily eating patterns and globally known branded fast foods.',
      'Return canonicalName in Turkish.',
      'If the item is a generic photo placeholder such as "Fotoğraftaki öğün", use the attached image as the primary evidence.',
      'For generic photo placeholders, do not hallucinate a specific single dish name unless it is visually obvious; estimate the visible plate conservatively.',
      'If the image appears to contain several separate foods but stage 1 failed to split them, estimate the total visible plate for this one review item.',
      'If the item clearly refers to a branded combo or menu, estimate the full combo unless the text excludes fries or drink.',
      'If quantity text is colloquial, infer a plausible single-user serving.',
      'Do not return implausibly low placeholder values.',
      'Prefer conservative but believable numbers and keep the result easy for a human to review and edit.',
    ].join(' '),
  },
];

const promptDefinitionByKey = new Map(AGENT_PROMPT_DEFINITIONS.map((definition) => [definition.key, definition]));

function toLegacyAppMetaKey(promptKey: string) {
  return `${PROMPT_KEY_PREFIX}${promptKey}`;
}

function parseValueJsonToText(valueJson: unknown) {
  if (typeof valueJson === 'string') {
    return valueJson;
  }

  if (valueJson && typeof valueJson === 'object' && 'text' in valueJson) {
    const row = valueJson as { text?: unknown };
    if (typeof row.text === 'string') {
      return row.text;
    }
  }

  return null;
}

export function getPromptDefinition(promptKey: string) {
  return promptDefinitionByKey.get(promptKey) ?? null;
}

async function getStoredPromptText(promptKey: string) {
  const columns = await getAppMetaColumnSet();

  if (columns.hasValue) {
    const rows = await prisma.$queryRaw<Array<{ value: string | null }>>`
      SELECT "value"
      FROM "AppMeta"
      WHERE "key" = ${toLegacyAppMetaKey(promptKey)}
      LIMIT 1
    `;

    return rows[0]?.value ?? null;
  }

  if (columns.hasValueJson && columns.hasNamespace) {
    const rows = await prisma.$queryRaw<Array<{ valueJson: unknown }>>`
      SELECT "valueJson"
      FROM "AppMeta"
      WHERE "namespace" = ${PROMPT_NAMESPACE}
        AND "key" = ${promptKey}
      LIMIT 1
    `;

    return parseValueJsonToText(rows[0]?.valueJson ?? null);
  }

  if (columns.hasValueJson) {
    const rows = await prisma.$queryRaw<Array<{ valueJson: unknown }>>`
      SELECT "valueJson"
      FROM "AppMeta"
      WHERE "key" = ${toLegacyAppMetaKey(promptKey)}
      LIMIT 1
    `;

    return parseValueJsonToText(rows[0]?.valueJson ?? null);
  }

  return null;
}

export async function getAgentPromptText(promptKey: string) {
  const definition = getPromptDefinition(promptKey);
  if (!definition) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const storedText = await getStoredPromptText(promptKey).catch(() => null);
  return storedText && storedText.trim().length > 0 ? storedText : definition.defaultText;
}

export async function listAgentPromptConfigs() {
  const columns = await getAppMetaColumnSet();

  let rows: Array<{ promptKey: string; storedText: string | null; updatedAt: Date | null }> = [];

  if (columns.hasValue) {
    const rawRows = await prisma.$queryRaw<Array<{ key: string; value: string | null; updatedAt: Date | null }>>`
      SELECT "key", "value", "updatedAt"
      FROM "AppMeta"
      WHERE "key" LIKE ${`${PROMPT_KEY_PREFIX}%`}
    `;

    rows = rawRows.map((row) => ({
      promptKey: row.key.replace(PROMPT_KEY_PREFIX, ''),
      storedText: row.value,
      updatedAt: row.updatedAt,
    }));
  } else if (columns.hasValueJson && columns.hasNamespace) {
    const rawRows = await prisma.$queryRaw<Array<{ key: string; valueJson: unknown; updatedAt: Date | null }>>`
      SELECT "key", "valueJson", "updatedAt"
      FROM "AppMeta"
      WHERE "namespace" = ${PROMPT_NAMESPACE}
    `;

    rows = rawRows.map((row) => ({
      promptKey: row.key,
      storedText: parseValueJsonToText(row.valueJson),
      updatedAt: row.updatedAt,
    }));
  } else if (columns.hasValueJson) {
    const rawRows = await prisma.$queryRaw<Array<{ key: string; valueJson: unknown; updatedAt: Date | null }>>`
      SELECT "key", "valueJson", "updatedAt"
      FROM "AppMeta"
      WHERE "key" LIKE ${`${PROMPT_KEY_PREFIX}%`}
    `;

    rows = rawRows.map((row) => ({
      promptKey: row.key.replace(PROMPT_KEY_PREFIX, ''),
      storedText: parseValueJsonToText(row.valueJson),
      updatedAt: row.updatedAt,
    }));
  }

  const rowByPromptKey = new Map(
    rows
      .filter((row) => Boolean(promptDefinitionByKey.get(row.promptKey)))
      .map((row) => [row.promptKey, row] as const),
  );

  return AGENT_PROMPT_DEFINITIONS.map((definition) => {
    const row = rowByPromptKey.get(definition.key);
    const editedText = row?.storedText ?? null;

    return {
      key: definition.key,
      agent: definition.agent,
      scope: definition.scope,
      modelEnvKey: definition.modelEnvKey,
      promptText: editedText && editedText.trim().length > 0 ? editedText : definition.defaultText,
      isCustom: Boolean(editedText && editedText.trim().length > 0),
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function updateAgentPromptText(input: { key: string; text: string }) {
  const definition = getPromptDefinition(input.key);
  if (!definition) {
    throw new Error('Bilinmeyen prompt anahtarı.');
  }

  const trimmedText = input.text.trim();
  if (!trimmedText) {
    throw new Error('Prompt metni boş olamaz.');
  }

  const columns = await getAppMetaColumnSet();
  const recordId = `agent-prompt-${input.key}`;

  if (columns.hasValue) {
    await prisma.$executeRaw`
      INSERT INTO "AppMeta" ("id", "key", "value", "createdAt", "updatedAt")
      VALUES (${recordId}, ${toLegacyAppMetaKey(input.key)}, ${trimmedText}, NOW(), NOW())
      ON CONFLICT ("key")
      DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
    `;
    return;
  }

  if (columns.hasValueJson && columns.hasNamespace) {
    await prisma.$executeRaw`
      INSERT INTO "AppMeta" ("id", "namespace", "key", "valueJson", "valueSchemaJson", "version", "publishedAt", "publishedBy", "createdAt", "updatedAt")
      VALUES (${recordId}, ${PROMPT_NAMESPACE}, ${input.key}, ${JSON.stringify(trimmedText)}::jsonb, '{}'::jsonb, 1, NOW(), 'admin-ui', NOW(), NOW())
      ON CONFLICT ("namespace", "key")
      DO UPDATE SET
        "valueJson" = EXCLUDED."valueJson",
        "updatedAt" = NOW(),
        "publishedAt" = NOW(),
        "publishedBy" = 'admin-ui',
        "version" = "AppMeta"."version" + 1
    `;
    return;
  }

  if (columns.hasValueJson) {
    await prisma.$executeRaw`
      INSERT INTO "AppMeta" ("id", "key", "valueJson", "createdAt", "updatedAt")
      VALUES (${recordId}, ${toLegacyAppMetaKey(input.key)}, ${JSON.stringify(trimmedText)}::jsonb, NOW(), NOW())
      ON CONFLICT ("key")
      DO UPDATE SET "valueJson" = EXCLUDED."valueJson", "updatedAt" = NOW()
    `;
    return;
  }

  throw new Error('AppMeta tablosunda prompt saklamak için desteklenen kolon yapısı bulunamadı.');
}
