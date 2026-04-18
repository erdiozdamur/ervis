import type { ZodError } from 'zod';
import { z } from 'zod';
import { isValidAppDayKey } from '@/lib/date/istanbul';

const mealMacroSchema = z.object({
  calories: z.coerce.number().min(0, 'Calories cannot be negative.').max(5000, 'Calories look too high for one item.'),
  proteinGrams: z.coerce.number().min(0, 'Protein cannot be negative.').max(500, 'Protein looks too high for one item.'),
  carbGrams: z.coerce.number().min(0, 'Carbs cannot be negative.').max(500, 'Carbs look too high for one item.'),
  fatGrams: z.coerce.number().min(0, 'Fat cannot be negative.').max(300, 'Fat looks too high for one item.'),
  fiberGrams: z.coerce.number().min(0, 'Fiber cannot be negative.').max(200, 'Fiber looks too high for one item.'),
});

const finalMealItemSchema = z.object({
  id: z.string().trim().min(1, 'Meal item id is required.'),
  displayName: z.string().trim().min(1, 'Give this item a clear name.').max(160, 'Item names can be up to 160 characters.'),
  quantityAmount: z.union([z.coerce.number().min(0, 'Portion amount cannot be negative.'), z.null()]).transform((value) => value ?? null),
  quantityUnit: z
    .string()
    .trim()
    .max(32, 'Portion unit can be up to 32 characters.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  gramsEstimate: z
    .union([z.coerce.number().min(0, 'Grams cannot be negative.').max(5000, 'Grams look too high for one item.'), z.null()])
    .transform((value) => value ?? null),
  macros: mealMacroSchema,
});

export const finalMealUpdateSchema = z.object({
  dayKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid day.')
    .refine((value) => isValidAppDayKey(value), 'Choose a valid Istanbul-local day.'),
  title: z.string().trim().min(1, 'Give this meal a short title.').max(120, 'Meal title can be up to 120 characters.'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'], {
    errorMap: () => ({ message: 'Choose the meal type that fits best.' }),
  }),
  consumedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Choose a valid time.'),
  notes: z
    .string()
    .trim()
    .max(600, 'Notes can be up to 600 characters.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  items: z.array(finalMealItemSchema).min(1, 'Keep at least one item in the meal.').max(24, 'Too many items were submitted.'),
});

export type FinalMealUpdateInput = z.infer<typeof finalMealUpdateSchema>;

export function flattenFinalMealFieldErrors(error: ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');

    if (!path || fieldErrors[path]) {
      continue;
    }

    fieldErrors[path] = issue.message;
  }

  return fieldErrors;
}
