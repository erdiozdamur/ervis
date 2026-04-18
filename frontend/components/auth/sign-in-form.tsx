'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { BottomActionBar } from '@/components/layout/bottom-action-bar';
import { MobileAppShell } from '@/components/layout/mobile-app-shell';
import { Stack } from '@/components/layout/stack';
import { AuthField } from '@/components/auth/auth-field';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { AUTH_APP_PATH, AUTH_SIGN_UP_PATH } from '@/lib/auth/constants';
import { flattenFieldErrors, signInSchema } from '@/lib/auth/validation';
import type { AuthFieldErrors } from '@/types/auth';

type SignInFormProps = {
  callbackUrl: string;
  defaultEmail?: string;
  notice?: string | null;
};

export function SignInForm({ callbackUrl, defaultEmail, notice }: SignInFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const signUpHref = AUTH_SIGN_UP_PATH as Route;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!parsed.success) {
      setFieldErrors(flattenFieldErrors(parsed.error) as AuthFieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        const result = await signIn('credentials', {
          email: parsed.data.email,
          password: parsed.data.password,
          redirect: false,
          callbackUrl,
        });

        if (!result || result.error) {
          setFormError('E-posta veya şifre hatalı.');
          return;
        }

        router.replace((result.url ?? AUTH_APP_PATH) as Route);
        router.refresh();
      } catch {
        setFormError('Giriş şu anda kullanılamıyor. Tekrar dene.');
      }
    });
  }

  return (
    <MobileAppShell
      footer={
        <BottomActionBar>
          <button type="submit" form="sign-in-form" className={buttonStyles({ fullWidth: true })} disabled={isPending}>
            {isPending ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </button>
          <Link href={signUpHref} className={buttonStyles({ variant: 'secondary', fullWidth: true })}>
            Kayıt ol
          </Link>
        </BottomActionBar>
      }
    >
      <Stack gap="xl">
        <Card tone="hero" className="py-6">
          <div className="flex items-center justify-between gap-3">
            <StatusPill tone="success">Hoş geldin</StatusPill>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Güvenli giriş</p>
          </div>

          <h1 className="mt-5 font-display text-4xl leading-none text-slate-950">Giriş yap</h1>
        </Card>

        <Card>
          <form id="sign-in-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Hesap</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">E-posta ve şifre</h2>
            </div>

            {notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
            ) : null}

            {formError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
            ) : null}

            <AuthField
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              label="Email"
              placeholder="ornek@mail.com"
              defaultValue={defaultEmail}
              error={fieldErrors.email}
            />

            <AuthField
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              label="Şifre"
              hint="8+ karakter"
              placeholder="Şifreni gir"
              error={fieldErrors.password}
            />

            <p className="text-sm leading-6 text-slate-500">
              Hesabın yok mu?{' '}
              <Link href={signUpHref} className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">
                Kayıt ol
              </Link>
              .
            </p>
          </form>
        </Card>
      </Stack>
    </MobileAppShell>
  );
}
