'use client';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

type AdminErrorProps = {
  reset: () => void;
};

export default function AdminError({ reset }: AdminErrorProps) {
  return (
    <Stack gap="lg">
      <ScreenHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="An admin request did not complete."
      />

      <StatePanel
        variant="error"
        title="Admin modules need another try"
        description="Error handling is standardized across admin tabs, so you can safely retry without losing navigation context."
        action={
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </Stack>
  );
}
