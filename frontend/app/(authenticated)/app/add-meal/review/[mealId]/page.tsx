import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatePanel } from '@/components/ui/state-panel';
import { StatWidget } from '@/components/ui/stat-widget';
import { StatusPill } from '@/components/ui/status-pill';
import { AnalysisStatusPanel } from '@/components/meal-entry/analysis-status-panel';
import { requireCurrentUser } from '@/lib/auth/session';
import { getMealDraftReview } from '@/services/meals/meal-review-service';
import { MealDraftReviewExperience } from '@/components/meal-entry/meal-draft-review-experience';

type MealDraftReviewPageProps = {
  params: {
    mealId: string;
  };
};

export default async function MealDraftReviewPage({ params }: MealDraftReviewPageProps) {
  const user = await requireCurrentUser();
  const draft = await getMealDraftReview(user.id, params.mealId);

  if (!draft) {
    return (
      <Stack gap="xl">
        <ScreenHeader
          eyebrow="Meal review"
          title="This draft could not be found"
          description="Create a new draft and try again."
        />

        <StatePanel
          variant="error"
          title="Review unavailable"
          description="Return to add meal."
          action={
            <Link href={'/app/add-meal' as Route} className={buttonStyles({ variant: 'secondary' })}>
              Back to add meal
            </Link>
          }
        />
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <section aria-labelledby="meal-review-title">
        <ScreenHeader eyebrow="Meal review" title="Confirm meal" />

        <Card tone="hero">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Draft</p>
              <h1 id="meal-review-title" className="mt-2 font-display text-4xl leading-none text-slate-950">
                Confirm
              </h1>
            </div>
            <StatusPill tone={draft.analysisStatus === 'FAILED' ? 'neutral' : 'success'}>{draft.analysisStatus.toLowerCase()}</StatusPill>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatWidget label="Text" value={`${draft.textCount}`} helper="notes" />
            <StatWidget label="Images" value={`${draft.imageCount}`} helper="photos" />
            <StatWidget label="Audio" value={`${draft.audioCount}`} helper="voice" />
          </div>

          <div className="mt-6 rounded-[24px] border border-white/70 bg-white/82 p-4 shadow-soft text-sm text-slate-600">
            {draft.dateLabel} · {draft.createdAtLabel}
          </div>
        </Card>
      </section>

      <AnalysisStatusPanel
        mealId={draft.mealId}
        analysisStatus={draft.analysisStatus}
        analysisErrorMessage={draft.analysisErrorMessage}
        hasDraftResult={Boolean(draft.draftResult)}
        analysisPromptVersion={draft.analysisPromptVersion}
      />

      {!draft.draftResult ? (
        <StatePanel
          variant="empty"
          title="No result yet"
          description="Run analysis again or start a new draft."
          action={
            <Link href={'/app/add-meal' as Route} className={buttonStyles({ variant: 'secondary' })}>
              New draft
            </Link>
          }
        />
      ) : null}

      {draft.draftResult ? (
        <section aria-labelledby="draft-result-heading">
          <ScreenHeader eyebrow="Draft result" title="Items" />

          <MealDraftReviewExperience mealId={draft.mealId} dayKey={draft.dayKey} initialDraftResult={draft.draftResult} />
        </section>
      ) : null}

      <section aria-labelledby="draft-inputs-heading">
        <details className="rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-soft">
          <summary id="draft-inputs-heading" className="cursor-pointer text-sm font-semibold text-slate-900">
            Original inputs
          </summary>

          <Stack gap="md" className="mt-4">
            {draft.assets.map((asset) => (
              <Card key={asset.id} tone="subtle" className="overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{asset.label}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {asset.sourceLabel ? `${asset.sourceLabel} · ` : ''}
                    Added at {asset.createdAtLabel}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-700">
                  <Icon name={asset.assetType === 'AUDIO' ? 'microphone' : asset.assetType === 'TEXT' ? 'text' : 'photo'} className="h-5 w-5" />
                </div>
              </div>

              {asset.assetType === 'TEXT' ? (
                <div className="mt-4 rounded-[24px] bg-slate-50 p-4 text-sm leading-6 text-slate-700">{asset.textContent}</div>
              ) : null}

              {asset.assetType === 'IMAGE' && asset.previewRoute ? (
                <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200">
                  <Image
                    src={asset.previewRoute}
                    alt={asset.label}
                    width={960}
                    height={640}
                    unoptimized
                    className="h-64 w-full object-cover"
                  />
                </div>
              ) : null}

              {asset.assetType === 'AUDIO' && asset.previewRoute ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <audio controls preload="metadata" className="w-full">
                      <source src={asset.previewRoute} type={asset.mimeType ?? 'audio/webm'} />
                    </audio>
                  </div>

                  {asset.transcriptText ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Transcript ready</p>
                        </div>
                        <StatusPill tone="success">{asset.transcriptLanguage === 'tr' ? 'Turkish' : 'Transcript'}</StatusPill>
                      </div>
                      <div className="mt-4 rounded-[20px] bg-white/90 p-4 text-sm leading-6 text-slate-700">{asset.transcriptText}</div>
                    </div>
                  ) : null}

                  {!asset.transcriptText && asset.transcriptStatus ? (
                    <StatePanel
                      variant={asset.transcriptStatus === 'failed' ? 'error' : 'loading'}
                      title={asset.transcriptStatus === 'failed' ? 'Transcript failed' : 'Transcript unavailable'}
                      description={asset.transcriptMessage ?? 'Audio is saved.'}
                    />
                  ) : null}
                </div>
              ) : null}

              {asset.fileSizeBytes ? (
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">{Math.max(1, Math.round(asset.fileSizeBytes / 1024))} KB</p>
              ) : null}
              </Card>
            ))}
          </Stack>
        </details>
      </section>
    </Stack>
  );
}
