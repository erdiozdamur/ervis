import type { ZodError } from 'zod';
import { z } from 'zod';
import { isValidAppDayKey } from '@/lib/date/istanbul';

export const mealUpdateSchema = z.object({
  dayKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid day.')
    .refine((value) => isValidAppDayKey(value), 'Choose a valid Istanbul-local day.'),
  title: z
    .string()
    .trim()
    .max(120, 'Meal title can be up to 120 characters.')
    .transform((value) => (value.length > 0 ? value : null)),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'], {
    errorMap: () => ({ message: 'Choose the meal type that fits best.' }),
  }),
  consumedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Choose a valid time.'),
  notes: z
    .string()
    .trim()
    .max(600, 'Notes can be up to 600 characters.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type MealUpdateInput = z.infer<typeof mealUpdateSchema>;

export function flattenMealFieldErrors(error: ZodError) {
  const flattened = error.flatten().fieldErrors;

  return Object.fromEntries(
    Object.entries(flattened)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
