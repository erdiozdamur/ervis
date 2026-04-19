import { NextResponse } from 'next/server';
import { flattenFieldErrors, signUpSchema } from '@/lib/auth/validation';
import { registerUser } from '@/services/auth/auth-service';
import type { RegisterUserResult } from '@/types/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signUpSchema.safeParse(body);

  if (!parsed.success) {
    const response: RegisterUserResult = {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Lütfen işaretlenen alanları düzeltip tekrar dene.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };

    return NextResponse.json(response, { status: 400 });
  }

  const result = await registerUser(parsed.data);

  if (!result.ok) {
    const status = result.code === 'EMAIL_TAKEN' ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
