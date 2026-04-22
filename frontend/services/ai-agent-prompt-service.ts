import { prisma } from '@/db/prisma';

export type AgentPromptDefinition = {
  key: string;
  agent: string;
  scope: string;
  modelEnvKey: 'MEAL_ANALYSIS_STAGE1_MODEL' | 'MEAL_ANALYSIS_STAGE2_MODEL';
  defaultText: string;
};

const PROMPT_KEY_PREFIX = 'agent_prompt:';

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

function toAppMetaKey(promptKey: string) {
  return `${PROMPT_KEY_PREFIX}${promptKey}`;
}

export function getPromptDefinition(promptKey: string) {
  return promptDefinitionByKey.get(promptKey) ?? null;
}

export async function getAgentPromptText(promptKey: string) {
  const definition = getPromptDefinition(promptKey);
  if (!definition) {
    throw new Error(`Unknown prompt key: ${promptKey}`);
  }

  const promptMeta = await prisma.appMeta.findUnique({
    where: {
      key: toAppMetaKey(promptKey),
    },
    select: {
      value: true,
    },
  });

  return promptMeta?.value && promptMeta.value.trim().length > 0 ? promptMeta.value : definition.defaultText;
}

export async function listAgentPromptConfigs() {
  const appMetaRows = await prisma.appMeta.findMany({
    where: {
      key: {
        startsWith: PROMPT_KEY_PREFIX,
      },
    },
    select: {
      key: true,
      value: true,
      updatedAt: true,
    },
  });

  const rowByPromptKey = new Map(
    appMetaRows
      .map((row) => {
        const promptKey = row.key.replace(PROMPT_KEY_PREFIX, '');
        return [promptKey, row] as const;
      })
      .filter(([promptKey]) => Boolean(promptDefinitionByKey.get(promptKey))),
  );

  return AGENT_PROMPT_DEFINITIONS.map((definition) => {
    const row = rowByPromptKey.get(definition.key);
    const editedText = row?.value ?? null;

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

  await prisma.appMeta.upsert({
    where: {
      key: toAppMetaKey(input.key),
    },
    update: {
      value: trimmedText,
    },
    create: {
      key: toAppMetaKey(input.key),
      value: trimmedText,
    },
  });
}
