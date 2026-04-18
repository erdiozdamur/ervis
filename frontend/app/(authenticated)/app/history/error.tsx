'use client';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { StatePanel } from '@/components/ui/state-panel';

type HistoryErrorProps = {
  reset: () => void;
};

export default function HistoryError({ reset }: HistoryErrorProps) {
  return (
    <Stack gap="xl">
      <ScreenHeader
        eyebrow="History"
        title="This day could not be loaded"
        description="The history screen keeps today and past days separate, but this request did not complete cleanly."
      />

      <StatePanel
        variant="error"
        title="The history timeline needs another try"
        description="Nothing has been changed. You can retry this day now or return to today and keep using the app."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Stack>
  );
}
