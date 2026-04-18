import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Card } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/state-panel';

export default function MealDraftReviewLoading() {
  return (
    <Stack gap="xl">
      <ScreenHeader
        eyebrow="Meal review"
        title="Loading the saved draft"
        description="The app is pulling the stored intake assets and queued analysis state for this meal."
      />

      <Card tone="hero">
        <div className="h-5 w-24 animate-pulse-soft rounded-full bg-slate-200" />
        <div className="mt-4 h-12 w-40 animate-pulse-soft rounded-3xl bg-slate-200" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
          <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
          <div className="h-24 animate-pulse-soft rounded-[24px] bg-slate-200" />
        </div>
      </Card>

      <StatePanel
        variant="loading"
        title="Preparing the review state"
        description="This is the handoff between raw intake and the later editable AI result."
      />
    </Stack>
  );
}
