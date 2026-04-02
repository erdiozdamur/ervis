'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { registerSchema } from '@/server/auth/credentials';

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    };

    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      setSuccess(null);
      setError(parsed.error.issues[0]?.message ?? 'Invalid registration data');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const responseBody = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(responseBody?.error ?? 'Unable to register with the provided information');
      setIsSubmitting(false);
      return;
    }

    setSuccess('Account created. You can now sign in.');
    setIsSubmitting(false);
    event.currentTarget.reset();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Register with your email and password.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">Name</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="name" name="name" autoComplete="name" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">Confirm password</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-green-600">{success}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
