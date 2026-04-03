'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Bot, Mail, LockKeyhole } from 'lucide-react';
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/10 text-cyan-100">
          <Bot size={20} />
        </div>
        <h1 className="text-2xl font-semibold text-white">Sign in to Ervis</h1>
        <p className="mt-2 text-sm text-slate-400">Use your email and password to continue.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="email"><Mail size={14} />Email</label>
            <input className="field" id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-300" htmlFor="password"><LockKeyhole size={14} />Password</label>
            <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {showGoogle ? (
          <Button className="mt-3 w-full" type="button" variant="secondary" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
            Continue with Google
          </Button>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-400">
          Need an account?{' '}
          <Link href="/register" className="font-medium text-cyan-200 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
