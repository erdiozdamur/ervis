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
import { AUTH_APP_PATH, AUTH_SIGN_IN_PATH } from '@/lib/auth/constants';
import { flattenFieldErrors, signUpSchema } from '@/lib/auth/validation';
import type { AuthFieldErrors, RegisterUserResult } from '@/types/auth';

type SignUpFormProps = {
  callbackUrl: string;
};

export function SignUpForm({ callbackUrl }: SignUpFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const signInHref = AUTH_SIGN_IN_PATH as Route;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      setFieldErrors(flattenFieldErrors(parsed.error) as AuthFieldErrors);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(parsed.data),
        });

        const payload = (await response.json().catch(() => null)) as RegisterUserResult | null;

        if (!response.ok || !payload?.ok) {
          setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
          setFormError(payload?.ok === false ? payload.message : 'Account creation failed. Please try again.');
          return;
        }

        const result = await signIn('credentials', {
          email: parsed.data.email,
          password: parsed.data.password,
          redirect: false,
          callbackUrl,
        });

        if (!result || result.error) {
          const fallbackHref = `${signInHref}?notice=account-created&email=${encodeURIComponent(
            parsed.data.email,
          )}&next=${encodeURIComponent(callbackUrl)}` as Route;
          router.replace(fallbackHref);
          router.refresh();
          return;
        }

        router.replace((result.url ?? AUTH_APP_PATH) as Route);
        router.refresh();
      } catch {
        setFormError('Account creation is unavailable right now. Confirm the local frontend server is running and try again.');
      }
    });
  }

  return (
    <MobileAppShell
      footer={
        <BottomActionBar>
          <button type="submit" form="sign-up-form" className={buttonStyles({ fullWidth: true })} disabled={isPending}>
            {isPending ? 'Creating account...' : 'Create account'}
          </button>
          <Link href={signInHref} className={buttonStyles({ variant: 'secondary', fullWidth: true })}>
            I already have an account
          </Link>
        </BottomActionBar>
      }
    >
      <Stack gap="xl">
        <Card tone="hero" className="py-6">
          <div className="flex items-center justify-between gap-3">
            <StatusPill tone="success">Create account</StatusPill>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Private by default</p>
          </div>

          <h1 className="mt-5 font-display text-4xl leading-none text-slate-950">Create account</h1>
        </Card>

        <Card>
          <form id="sign-up-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Get started</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Basic account info</h2>
            </div>

            {formError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
            ) : null}

            <AuthField
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              label="Name"
              hint="Optional"
              placeholder="How should we address you?"
              error={fieldErrors.name}
            />

            <AuthField
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              label="Email"
              placeholder="you@example.com"
              error={fieldErrors.email}
            />

            <AuthField
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              label="Password"
              hint="8+ chars"
              placeholder="Create a password"
              error={fieldErrors.password}
            />

            <AuthField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              label="Confirm password"
              placeholder="Repeat your password"
              error={fieldErrors.confirmPassword}
            />

            <p className="text-sm leading-6 text-slate-500">
              Already have an account?{' '}
              <Link href={signInHref} className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">
                Sign in
              </Link>
              .
            </p>
          </form>
        </Card>
      </Stack>
    </MobileAppShell>
  );
}
