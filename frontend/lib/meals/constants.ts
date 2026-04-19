import type { MealType } from '@prisma/client';

export const mealTypeOptions = [
  {
    value: 'BREAKFAST',
    label: 'Kahvaltı',
    description: 'Sabah öğünleri ve kısa kahve molaları.',
  },
  {
    value: 'LUNCH',
    label: 'Öğle',
    description: 'Günü taşıyan öğle öğünleri.',
  },
  {
    value: 'DINNER',
    label: 'Akşam',
    description: 'Akşam öğünleri ve daha büyük porsiyonlar.',
  },
  {
    value: 'SNACK',
    label: 'Atıştırma',
    description: 'Küçük ara öğünler ve hızlı takviyeler.',
  },
  {
    value: 'OTHER',
    label: 'Diğer',
    description: 'Diğer kategorilere uymayan girişler.',
  },
] as const satisfies Array<{
  value: MealType;
  label: string;
  description: string;
}>;

const mealTypeLabelMap = Object.fromEntries(mealTypeOptions.map((option) => [option.value, option.label])) as Record<
  MealType,
  string
>;

export function formatMealTypeLabel(mealType: MealType) {
  return mealTypeLabelMap[mealType];
}
