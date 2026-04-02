'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { loginSchema } from '@/server/auth/credentials';

type LoginFormProps = {
  showGoogle: boolean;
};

export function LoginForm({ showGoogle }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    };

    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email or password');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      callbackUrl: '/dashboard',
      redirect: false,
    });

    if (!result || result.error) {
      setError('Invalid email or password');
      setIsSubmitting(false);
      return;
    }

    window.location.href = result.url ?? '/dashboard';
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold">Sign in to Ervis</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your email and password to continue.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {showGoogle ? (
          <Button className="mt-3 w-full" type="button" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
            Continue with Google
          </Button>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
