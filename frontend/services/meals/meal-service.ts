import { prisma } from '@/db/prisma';
import {
  formatTimeInAppTimeZone,
  formatTimeInputInAppTimeZone,
  getAppDateTimeFromDayKeyAndTime,
  getAppDayDateFromDayKey,
} from '@/lib/date/istanbul';
import type { MealUpdateInput } from '@/lib/meals/validation';

type UpdatedMealSnapshot = {
  id: string;
  title: string;
  mealType: MealUpdateInput['mealType'];
  consumedAtLabel: string;
  consumedAtValue: string;
  notes: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function updateOwnedMeal(userId: string, mealId: string, input: MealUpdateInput): Promise<UpdatedMealSnapshot | null> {
  const existingMeal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!existingMeal) {
    return null;
  }

  const consumedAt = getAppDateTimeFromDayKeyAndTime(input.dayKey, input.consumedTime);
  const mealDate = getAppDayDateFromDayKey(input.dayKey);

  const updatedMeal = await prisma.meal.update({
    where: {
      id: mealId,
    },
    data: {
      title: normalizeOptionalText(input.title),
      mealType: input.mealType,
      notes: normalizeOptionalText(input.notes),
      timeZone: 'Europe/Istanbul',
      mealDate,
      consumedAt,
    },
    select: {
      id: true,
      title: true,
      mealType: true,
      notes: true,
      consumedAt: true,
    },
  });

  return {
    id: updatedMeal.id,
    title: updatedMeal.title ?? 'Meal',
    mealType: updatedMeal.mealType,
    consumedAtLabel: formatTimeInAppTimeZone(updatedMeal.consumedAt),
    consumedAtValue: formatTimeInputInAppTimeZone(updatedMeal.consumedAt),
    notes: updatedMeal.notes,
  };
}

export async function deleteOwnedMeal(userId: string, mealId: string) {
  const result = await prisma.meal.deleteMany({
    where: {
      id: mealId,
      userId,
    },
  });

  return result.count > 0;
}
