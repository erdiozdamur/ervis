import { prisma } from '@/db/prisma';
import { analysisRuleSetSchema, type AnalysisRuleSet } from '@/lib/analysis-rules/schema';

const ANALYSIS_RULES_META_KEY = 'analysis_rules';

const defaultAnalysisRules: AnalysisRuleSet = {
  stage1: {
    platterKeywords: [
      'meze tabağı',
      'meze tabagi',
      'karışık türk mezesi tabağı',
      'karisik turk mezesi tabagi',
      'karışık meze tabağı',
      'karisik meze tabagi',
      'kahvaltı tabağı',
      'kahvalti tabagi',
      'karışık tabak',
      'karisik tabak',
      'meze plate',
      'mixed plate',
      'turkish meze plate',
      'platter',
    ],
    genericImageNamePrefixes: ['img', 'image', 'images', 'photo', 'camera', 'screenshot', 'ekran resmi', 'whatsapp image', 'dsc', 'pxl'],
    compositeDishRules: [
      {
        id: 'karniyarik',
        dishName: 'Karnıyarık',
        dishKeywords: ['karnıyarık', 'karniyarik'],
        componentKeywords: ['patlıcan', 'patlican', 'kıyma', 'kiyma', 'pirinç', 'pirinc', 'domates', 'biber', 'soğan', 'sogan'],
        enabled: true,
        priority: 10,
      },
      {
        id: 'musakka',
        dishName: 'Musakka',
        dishKeywords: ['musakka'],
        componentKeywords: ['patlıcan', 'patlican', 'kıyma', 'kiyma', 'patates', 'domates', 'biber', 'soğan', 'sogan'],
        enabled: true,
        priority: 20,
      },
      {
        id: 'manti',
        dishName: 'Mantı',
        dishKeywords: ['mantı', 'manti'],
        componentKeywords: ['yoğurt', 'yogurt', 'kıyma', 'kiyma', 'hamur', 'sos'],
        enabled: true,
        priority: 30,
      },
    ],
  },
};


export function getDefaultAnalysisRules(): AnalysisRuleSet {
  return sortRules(structuredClone(defaultAnalysisRules));
}
function sortRules(ruleSet: AnalysisRuleSet): AnalysisRuleSet {
  return {
    ...ruleSet,
    stage1: {
      ...ruleSet.stage1,
      compositeDishRules: [...ruleSet.stage1.compositeDishRules].sort((a, b) => a.priority - b.priority),
    },
  };
}

export async function getAnalysisRules() {
  try {
    const meta = await prisma.appMeta.findUnique({ where: { key: ANALYSIS_RULES_META_KEY } });

    if (!meta?.value) {
      return { rules: getDefaultAnalysisRules(), source: 'default' as const };
    }

    const parsedJson = (() => {
      try {
        return JSON.parse(meta.value) as unknown;
      } catch {
        return null;
      }
    })();
    const parsed = analysisRuleSetSchema.safeParse(parsedJson);

    if (!parsed.success) {
      return { rules: getDefaultAnalysisRules(), source: 'default_invalid_stored' as const, errors: parsed.error.flatten() };
    }

    return { rules: sortRules(parsed.data), source: 'app_meta' as const };
  } catch {
    return { rules: getDefaultAnalysisRules(), source: 'default_repository_unavailable' as const };
  }
}

export async function saveAnalysisRules(rawRules: unknown) {
  const parsed = analysisRuleSetSchema.safeParse(rawRules);

  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten() };
  }

  const sorted = sortRules(parsed.data);

  await prisma.appMeta.upsert({
    where: { key: ANALYSIS_RULES_META_KEY },
    update: { value: JSON.stringify(sorted) },
    create: { key: ANALYSIS_RULES_META_KEY, value: JSON.stringify(sorted) },
  });

  return { ok: true as const, rules: sorted };
}
