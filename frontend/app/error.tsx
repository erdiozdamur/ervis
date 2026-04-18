'use client';

import { MobileAppShell } from '@/components/layout/mobile-app-shell';
import { Stack } from '@/components/layout/stack';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <MobileAppShell>
      <Card tone="hero">
        <Stack gap="md">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Something went wrong</p>
          <h1 className="font-display text-3xl leading-tight text-slate-950">The shell is safe, but this screen needs a retry.</h1>
          <p className="text-sm leading-6 text-slate-600">
            The error boundary is in place so future product flows fail gracefully instead of leaving users stranded.
          </p>
          <button type="button" onClick={reset} className={buttonStyles()}>
            Try again
          </button>
          <p className="text-xs text-slate-400">{error.digest ? `Digest: ${error.digest}` : 'Digest unavailable'}</p>
        </Stack>
      </Card>
    </MobileAppShell>
  );
}
