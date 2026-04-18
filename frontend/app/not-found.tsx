import Link from 'next/link';
import { MobileAppShell } from '@/components/layout/mobile-app-shell';
import { Stack } from '@/components/layout/stack';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <MobileAppShell>
      <Card tone="hero">
        <Stack gap="md">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Not found</p>
          <h1 className="font-display text-3xl leading-tight text-slate-950">This route has not been designed yet.</h1>
          <p className="text-sm leading-6 text-slate-600">
            The app returns a clean recovery path instead of a dead end, which keeps the mobile experience feeling polished.
          </p>
          <Link href="/" className={buttonStyles()}>
            Back home
          </Link>
        </Stack>
      </Card>
    </MobileAppShell>
  );
}
