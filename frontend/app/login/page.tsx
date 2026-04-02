'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow">
        <h1 className="text-2xl font-semibold">Welcome to Ervis</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with Google to continue.</p>
        <Button className="mt-6 w-full" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>Continue with Google</Button>
      </div>
    </main>
  );
}
