import type { ZodError } from 'zod';
import { z } from 'zod';

export const profileFormSchema = z.object({
  age: z.coerce.number().int().min(18, 'Yaş 18 ile 80 arasında olmalı.').max(80, 'Yaş 18 ile 80 arasında olmalı.'),
  sex: z.enum(['FEMALE', 'MALE'], {
    errorMap: () => ({ message: 'Hesaplamaya en uygun cinsiyeti seç.' }),
  }),
  heightCm: z.coerce
    .number()
    .int()
    .min(120, 'Boy 120 ile 230 cm arasında olmalı.')
    .max(230, 'Boy 120 ile 230 cm arasında olmalı.'),
  weightKg: z.coerce
    .number()
    .min(35, 'Kilo 35 ile 300 kg arasında olmalı.')
    .max(300, 'Kilo 35 ile 300 kg arasında olmalı.'),
  goalType: z.enum(['LOSE_FAT', 'MAINTAIN', 'GAIN_MUSCLE'], {
    errorMap: () => ({ message: 'Şu anki hedefine en yakın seçeneği belirle.' }),
  }),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'], {
    errorMap: () => ({ message: 'Tipik haftana en uygun aktivite düzeyini seç.' }),
  }),
  trainingFrequencyPerWeek: z.coerce
    .number()
    .int()
    .min(0, 'Antrenman sıklığı 0 ile 14 arasında olmalı.')
    .max(14, 'Antrenman sıklığı 0 ile 14 arasında olmalı.'),
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
