'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MealAnalysisStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import type { MealAnalysisRunResponse } from '@/types/meal-analysis';

type AnalysisStatusPanelProps = {
  mealId: string;
  analysisStatus: MealAnalysisStatus;
  analysisErrorMessage: string | null;
  hasDraftResult: boolean;
  analysisPromptVersion: string | null;
};

function getPanelCopy({
  analysisStatus,
  hasDraftResult,
  analysisErrorMessage,
  analysisPromptVersion,
}: Omit<AnalysisStatusPanelProps, 'mealId'>) {
  if (analysisStatus === 'FAILED') {
    return {
      variant: 'error' as const,
      title: 'The draft analysis needs another pass',
      description:
        analysisErrorMessage ??
        'The draft inputs are still safely stored, but this analysis run did not produce a reviewable meal result yet.',
      actionLabel: 'Run analysis again',
    };
  }

  if (analysisStatus === 'CANCELLED') {
    return {
      variant: 'error' as const,
      title: 'This analysis run did not finish',
      description:
        analysisErrorMessage ??
        'The draft inputs are still safe, but this analysis run ended before a reviewable meal result was returned.',
      actionLabel: 'Run analysis again',
    };
  }

  if (hasDraftResult) {
    return {
      variant: 'success' as const,
      title: 'Draft meal result is ready for review',
      description:
        'A draft result is ready, but it remains editable and separate from final saved meal records until you confirm it.',
      actionLabel: null,
    };
  }

  return {
    variant: 'loading' as const,
    title: analysisStatus === 'RUNNING' ? 'The draft analysis is still running' : 'The analysis contract has been prepared',
    description:
      analysisStatus === 'RUNNING'
        ? 'Your inputs are already attached to this draft. If the result does not appear soon, you can run the analysis again without losing the raw assets.'
        : analysisPromptVersion
          ? `A queued analysis request was recorded with prompt version ${analysisPromptVersion}. If needed, you can trigger a fresh run from here.`
          : 'A queued analysis request was recorded for this draft. If needed, you can trigger a fresh run from here.',
    actionLabel: 'Run analysis now',
  };
}

export function AnalysisStatusPanel(props: AnalysisStatusPanelProps) {
  const router = useRouter();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const panelCopy = getPanelCopy(props);

  function handleRunAnalysis() {
    if (isPending || panelCopy.actionLabel == null) {
      return;
    }

    setRequestError(null);
    setRequestSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/meals/${props.mealId}/analysis`, {
        method: 'POST',
      });

      const payload = (await response.json().catch(() => null)) as MealAnalysisRunResponse | { message?: string } | null;

      if (!response.ok || !payload || !('ok' in payload) || payload.ok === false) {
        const failureMessage =
          payload && 'ok' in payload && payload.ok === false
            ? payload.error.message
            : payload && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : 'The analysis could not be run right now. Please try again.';

        setRequestError(failureMessage);
        return;
      }

      setRequestSuccess('A fresh analysis run finished. The review screen will refresh now.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <StatePanel
        variant={panelCopy.variant}
        title={panelCopy.title}
        description={panelCopy.description}
        action={
          panelCopy.actionLabel ? (
            <Button type="button" variant="secondary" onClick={handleRunAnalysis} disabled={isPending}>
              {isPending ? 'Running analysis...' : panelCopy.actionLabel}
            </Button>
          ) : undefined
        }
      />

      {requestError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{requestError}</div>
      ) : null}

      {requestSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{requestSuccess}</div>
      ) : null}
    </div>
  );
}
