import type { ZodError } from 'zod';
import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Ad en az 2 karakter olmalı.')
  .max(60, 'Ad en fazla 60 karakter olabilir.')
  .optional()
  .or(z.literal(''))
  .transform((value) => {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : undefined;
  });

const emailSchema = z
  .string()
  .trim()
  .min(1, 'E-posta zorunlu.')
  .email('Geçerli bir e-posta adresi gir.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı.')
  .max(128, 'Şifre en fazla 128 karakter olabilir.')
  .refine((value) => /[A-Za-z]/.test(value), 'Şifre en az bir harf içermeli.')
  .refine((value) => /\d/.test(value), 'Şifre en az bir rakam içermeli.');

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Lütfen şifreni tekrar gir.'),
  })
  .superRefine(({ password, confirmPassword }, context) => {
    if (password !== confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Şifreler aynı olmalı.',
        path: ['confirmPassword'],
      });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export function flattenFieldErrors(error: ZodError) {
  const flattened = error.flatten().fieldErrors;

  return Object.fromEntries(
    Object.entries(flattened)
      .map(([field, messages]) => [field, messages?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
