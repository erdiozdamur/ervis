import type { MealType } from '@prisma/client';

export const mealTypeOptions = [
  {
    value: 'BREAKFAST',
    label: 'Breakfast',
    description: 'Morning meals and coffee stops.',
  },
  {
    value: 'LUNCH',
    label: 'Lunch',
    description: 'Midday meals that keep the day moving.',
  },
  {
    value: 'DINNER',
    label: 'Dinner',
    description: 'Evening meals and larger plates.',
  },
  {
    value: 'SNACK',
    label: 'Snack',
    description: 'Small bites, treats, and quick top-ups.',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Anything that does not fit neatly elsewhere.',
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
