import type { MealStatus, MealType } from '@prisma/client';

export type MealCard = {
  id: string;
  title: string;
  mealType: MealType;
  status: MealStatus;
  consumedAtLabel: string;
  consumedAtValue: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  itemCount: number;
  notes: string | null;
  isDraft: boolean;
};

export type MealTotals = {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

export type MealTargets = {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

export type MealTargetDelta = {
  calories: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  fatGrams: number | null;
};

export type MealEditorItem = {
  id: string;
  displayName: string;
  quantityAmount: number | null;
  quantityUnit: string | null;
  gramsEstimate: number | null;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  fiberGrams: number;
};

export type MealEditorSnapshot = {
  mealId: string;
  status: MealStatus;
  dayKey: string;
  dateLabel: string;
  title: string;
  mealType: MealType;
  consumedTime: string;
  notes: string | null;
  items: MealEditorItem[];
  totals: MealTotals & {
    fiberGrams: number;
  };
};

export type MealDaySummary = {
  dayKey: string;
  dateLabel: string;
  targetCalories: number | null;
  targets: MealTargets | null;
  consumed: MealTotals;
  remaining: MealTargetDelta;
  mealCount: number;
  confirmedMealCount: number;
  hasDraftMeals: boolean;
  meals: MealCard[];
};

export type MealUpdateFieldErrors = Partial<Record<'dayKey' | 'title' | 'mealType' | 'consumedTime' | 'notes', string>>;

export type MealSaveFieldErrors = Partial<Record<string, string>>;

export type MealUpdateResult =
  | {
      ok: true;
      meal: Pick<MealCard, 'id' | 'title' | 'mealType' | 'consumedAtLabel' | 'consumedAtValue' | 'notes'>;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: MealUpdateFieldErrors;
    };

export type MealDeleteResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

export type MealSaveResult =
  | {
      ok: true;
      mealId: string;
      redirectTo: string;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: MealSaveFieldErrors;
    };
