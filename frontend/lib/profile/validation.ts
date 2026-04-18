import type { ZodError } from 'zod';
import { z } from 'zod';

export const profileFormSchema = z.object({
  age: z.coerce.number().int().min(18, 'Age must be between 18 and 80.').max(80, 'Age must be between 18 and 80.'),
  sex: z.enum(['FEMALE', 'MALE'], {
    errorMap: () => ({ message: 'Choose the sex option that best fits the estimate.' }),
  }),
  heightCm: z.coerce
    .number()
    .int()
    .min(120, 'Height must be between 120 and 230 cm.')
    .max(230, 'Height must be between 120 and 230 cm.'),
  weightKg: z.coerce
    .number()
    .min(35, 'Weight must be between 35 and 300 kg.')
    .max(300, 'Weight must be between 35 and 300 kg.'),
  goalType: z.enum(['LOSE_FAT', 'MAINTAIN', 'GAIN_MUSCLE'], {
    errorMap: () => ({ message: 'Choose the goal that feels closest right now.' }),
  }),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'], {
    errorMap: () => ({ message: 'Choose the activity level that matches your typical week.' }),
  }),
  trainingFrequencyPerWeek: z.coerce
    .number()
    .int()
    .min(0, 'Training frequency must be between 0 and 14.')
    .max(14, 'Training frequency must be between 0 and 14.'),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;

export function flattenProfileFieldErrors(error: ZodError) {
  const flattened = error.flatten().fieldErrors;

  return Object.fromEntries(
    Object.entries(flattened)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
