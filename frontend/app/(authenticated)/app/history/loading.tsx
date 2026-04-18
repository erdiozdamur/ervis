import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { StatePanel } from '@/components/ui/state-panel';

export default function HistoryLoading() {
  return (
    <Stack gap="xl">
      <section aria-labelledby="history-loading-title">
        <ScreenHeader
          eyebrow="History"
          title="Loading the selected day"
          description="The app is pulling the Istanbul-local meal group and daily totals for this screen."
        />

        <Card tone="hero">
          <div className="h-5 w-24 animate-pulse-soft rounded-full bg-slate-200" />
          <div className="mt-4 h-12 w-40 animate-pulse-soft rounded-3xl bg-slate-200" />
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="col-span-3 h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
            <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
            <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
            <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
          </div>
        </Card>
      </section>

      <StatePanel
        variant="loading"
        title="History is on the way"
        description="This stays focused on one day at a time so the screen can load quickly and remain easy to scan on mobile."
      />
    </Stack>
  );
}
