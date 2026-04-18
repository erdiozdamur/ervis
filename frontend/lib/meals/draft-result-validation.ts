import type { ZodError } from 'zod';
import { z } from 'zod';

const macroInputSchema = z.object({
  calories: z.coerce.number().min(0, 'Calories cannot be negative.').max(5000, 'Calories look too high for one draft item.'),
  proteinGrams: z.coerce.number().min(0, 'Protein cannot be negative.').max(500, 'Protein looks too high for one draft item.'),
  carbGrams: z.coerce.number().min(0, 'Carbs cannot be negative.').max(500, 'Carbs look too high for one draft item.'),
  fatGrams: z.coerce.number().min(0, 'Fat cannot be negative.').max(300, 'Fat looks too high for one draft item.'),
  fiberGrams: z.coerce.number().min(0, 'Fiber cannot be negative.').max(200, 'Fiber looks too high for one draft item.'),
});

const editableDraftItemSchema = z.object({
  id: z.string().trim().min(1, 'Draft item id is required.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Give this item a clear name.')
    .max(160, 'Item names can be up to 160 characters.'),
  quantityText: z
    .string()
    .trim()
    .max(60, 'Quantity text can be up to 60 characters.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  gramsEstimate: z
    .union([z.coerce.number().min(0, 'Grams cannot be negative.').max(5000, 'Grams look too high for one draft item.'), z.null()])
    .transform((value) => (value == null ? null : value)),
  macros: macroInputSchema,
});

export const mealDraftResultUpdateSchema = z.object({
  titleSuggestion: z
    .string()
    .trim()
    .min(1, 'Give this draft a short meal title.')
    .max(120, 'Meal titles can be up to 120 characters.'),
  mealTypeSuggestion: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'], {
    errorMap: () => ({ message: 'Choose the meal type that fits this draft best.' }),
  }),
  items: z.array(editableDraftItemSchema).min(1, 'Keep at least one draft item in the review.').max(24, 'Too many draft items were submitted.'),
});

export type MealDraftResultUpdateSchemaInput = z.infer<typeof mealDraftResultUpdateSchema>;

export function flattenMealDraftResultFieldErrors(error: ZodError) {
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
