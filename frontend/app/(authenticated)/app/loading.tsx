import { Stack } from '@/components/layout/stack';
import { Card } from '@/components/ui/card';

export default function AuthenticatedAppLoading() {
  return (
    <Stack gap="lg">
      <Card tone="hero" className="animate-pulse-soft">
        <div className="h-4 w-24 rounded-full bg-white/70" />
        <div className="mt-4 h-10 w-36 rounded-3xl bg-white/80" />
        <div className="mt-3 h-4 w-4/5 rounded-full bg-white/70" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 rounded-[24px] bg-white/75" />
          ))}
        </div>
      </Card>

      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="animate-pulse-soft">
            <div className="h-4 w-20 rounded-full bg-slate-200" />
            <div className="mt-4 h-3 rounded-full bg-slate-100" />
            <div className="mt-3 h-2 rounded-full bg-slate-100" />
          </Card>
        ))}
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="animate-pulse-soft">
          <div className="h-4 w-28 rounded-full bg-slate-200" />
          <div className="mt-4 h-20 rounded-[24px] bg-slate-100" />
        </Card>
      ))}
    </Stack>
  );
}
