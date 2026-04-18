'use client';

import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

type ErrorPageProps = {
  reset: () => void;
};

export default function AuthenticatedAppError({ reset }: ErrorPageProps) {
  return (
    <StatePanel
      variant="error"
      title="This app screen needs a fresh try"
      description="The shell keeps recovery graceful so later meal flows can fail safely without leaving the user stranded."
      action={<Button variant="secondary" onClick={reset}>Try again</Button>}
    />
  );
}
