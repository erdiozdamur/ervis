import { MobileAppShell } from '@/components/layout/mobile-app-shell';
import { Stack } from '@/components/layout/stack';
import { Card } from '@/components/ui/card';

export default function Loading() {
  return (
    <MobileAppShell>
      <Stack gap="lg">
        <Card tone="hero" className="animate-pulse-soft">
          <div className="h-5 w-28 rounded-full bg-white/70" />
          <div className="mt-4 h-12 w-4/5 rounded-3xl bg-white/80" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-white/70" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-white/75" />
            ))}
          </div>
        </Card>

        <Card className="animate-pulse-soft">
          <div className="h-5 w-32 rounded-full bg-slate-200/80" />
          <div className="mt-3 h-4 w-3/5 rounded-full bg-slate-200/80" />
          <div className="mt-6 h-36 rounded-3xl bg-slate-100/90" />
        </Card>
      </Stack>
    </MobileAppShell>
  );
}
