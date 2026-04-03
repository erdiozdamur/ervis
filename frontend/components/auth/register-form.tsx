'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Bot, LockKeyhole, Mail, User } from 'lucide-react';
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/10 text-cyan-100">
          <Bot size={20} />
        </div>
        <h1 className="text-2xl font-semibold text-white">Create your account</h1>
        <p className="mt-2 text-sm text-slate-400">Register with your email and password.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="name"><User size={14} />Name</label>
            <input className="field" id="name" name="name" autoComplete="name" required />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="email"><Mail size={14} />Email</label>
            <input className="field" id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="password"><LockKeyhole size={14} />Password</label>
            <input className="field" id="password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="confirmPassword"><LockKeyhole size={14} />Confirm password</label>
            <input className="field" id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-cyan-200 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
