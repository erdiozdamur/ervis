import { prisma } from '@/db/prisma';

export const PROMPT_TEMPLATE_KEYS = {
  stage1ImageItemizerPrimary: 'meal-analysis.stage1.image-itemizer.primary',
  stage1ImageItemizerRetry: 'meal-analysis.stage1.image-itemizer.retry',
  stage2NutritionResolver: 'meal-analysis.stage2.nutrition-resolver',
} as const;

type PromptTemplateDefault = {
  key: string;
  version: string;
  locale: string;
  systemInstructions: string;
  userTemplate: string;
};

const DEFAULT_PROMPT_TEMPLATES: Record<string, PromptTemplateDefault> = {
  [PROMPT_TEMPLATE_KEYS.stage1ImageItemizerPrimary]: {
    key: PROMPT_TEMPLATE_KEYS.stage1ImageItemizerPrimary,
    version: 'v1',
    locale: 'tr-TR',
    systemInstructions: [
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
    userTemplate: ['Meal type: {{mealType}}', 'Consumed at: {{consumedAtIso}}', 'Asset label hint: {{labelHint}}'].join('\n'),
  },
  [PROMPT_TEMPLATE_KEYS.stage1ImageItemizerRetry]: {
    key: PROMPT_TEMPLATE_KEYS.stage1ImageItemizerRetry,
    version: 'v1',
    locale: 'tr-TR',
    systemInstructions: [
      'You are separating a platter into distinct foods for a Turkish calorie tracking app.',
      'Return separate foods only when they are visibly distinct and separately served on the same plate.',
      'Do not return one umbrella label such as meze tabağı, karışık tabak, mixed plate, platter, or breakfast plate.',
      'Name each visible component separately in Turkish.',
      'If the image shows kısır, yaprak sarma, Rus salatası, börek, tatlı gibi ayrı bölümler, list them as separate items.',
      'If there are 3 or more clearly distinct food sections, return them separately instead of one combined answer.',
      'Do not split a single cooked mixed dish into ingredients.',
    ].join(' '),
    userTemplate: ['Meal type: {{mealType}}', 'Consumed at: {{consumedAtIso}}', 'Asset label hint: {{labelHint}}'].join('\n'),
  },
  [PROMPT_TEMPLATE_KEYS.stage2NutritionResolver]: {
    key: PROMPT_TEMPLATE_KEYS.stage2NutritionResolver,
    version: 'v1',
    locale: 'tr-TR',
    systemInstructions: [
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
    userTemplate: [
      'Meal type: {{mealType}}',
      'Consumed at: {{consumedAtIso}}',
      'Item kind: {{itemKind}}',
      'Item display name: {{displayName}}',
      'Normalized query: {{normalizedQuery}}',
      'Quantity text: {{quantityText}}',
      'Quantity multiplier: {{quantityMultiplier}}',
      'Stage 1 reasoning: {{reasoning}}',
      'Meal text and transcript context:',
      '{{textContext}}',
    ].join('\n'),
  },
};

export type ResolvedPromptTemplate = {
  id: string;
  key: string;
  version: string;
  locale: string;
  systemInstructions: string;
  userTemplate: string;
  source: 'db' | 'default';
};

function buildDefaultPromptTemplate(key: string): ResolvedPromptTemplate {
  const fallback = DEFAULT_PROMPT_TEMPLATES[key];
  if (!fallback) {
    return {
      id: `default:${key}`,
      key,
      version: 'v1',
      locale: 'tr-TR',
      systemInstructions: '',
      userTemplate: '',
      source: 'default',
    };
  }

  return {
    id: `default:${fallback.key}:${fallback.version}`,
    key: fallback.key,
    version: fallback.version,
    locale: fallback.locale,
    systemInstructions: fallback.systemInstructions,
    userTemplate: fallback.userTemplate,
    source: 'default',
  };
}

function renderTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'string') {
      return value;
    }

    return '';
  });
}

export function buildPromptVersionStamp(templates: ResolvedPromptTemplate[]) {
  return templates.map((template) => `${template.key}@${template.version}#${template.id}`).join('|');
}

export async function getActivePromptTemplate(key: string): Promise<ResolvedPromptTemplate> {
  const fallback = buildDefaultPromptTemplate(key);

  try {
    const active = await prisma.promptTemplate.findFirst({
      where: {
        key,
        isActive: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        key: true,
        version: true,
        locale: true,
        systemInstructions: true,
        userTemplate: true,
      },
    });

    if (!active) {
      return fallback;
    }

    return {
      ...active,
      source: 'db',
    };
  } catch {
    return fallback;
  }
}

export async function getMealAnalysisPromptStamp() {
  const [stage1Primary, stage1Retry, stage2] = await Promise.all([
    getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage1ImageItemizerPrimary),
    getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage1ImageItemizerRetry),
    getActivePromptTemplate(PROMPT_TEMPLATE_KEYS.stage2NutritionResolver),
  ]);

  return buildPromptVersionStamp([stage1Primary, stage1Retry, stage2]);
}

export function renderPromptTemplate(template: ResolvedPromptTemplate, values: Record<string, string | number | null | undefined>) {
  return {
    template,
    instructions: template.systemInstructions,
    userPrompt: renderTemplate(template.userTemplate, values),
  };
}

export function getDefaultPromptTemplates() {
  return Object.values(DEFAULT_PROMPT_TEMPLATES);
}
