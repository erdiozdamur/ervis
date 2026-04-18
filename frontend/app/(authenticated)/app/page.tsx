import Link from 'next/link';
import { requireCurrentUser } from '@/lib/auth/session';
import { getTodaySummary } from '@/services/today/today-service';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/state-panel';
import { DailyBalanceCard } from '@/components/today/daily-balance-card';
import { MacroProgressRow } from '@/components/today/macro-progress-row';
import { TodayMealListItem } from '@/components/today/today-meal-list-item';

function getDayState(summary: Awaited<ReturnType<typeof getTodaySummary>>) {
  if (summary.mealCount === 0) {
    return {
      tone: 'Fresh start',
      panelVariant: 'empty' as const,
      panelTitle: 'No meals logged yet for today',
      panelDescription:
        'Start with breakfast, a quick snack, or a photo-first draft. New meal data can refresh this screen as soon as a draft is created or confirmed.',
    };
  }

  if (summary.targetCalories != null && summary.remaining.calories != null && summary.remaining.calories <= 0) {
    return {
      tone: 'Target reached',
      panelVariant: 'success' as const,
      panelTitle: 'Your day already has solid coverage',
      panelDescription:
        'Meals are recorded for today and the calorie target has been met or passed. Draft meals still stay reviewable before confirmation.',
    };
  }

  return {
    tone: 'In progress',
    panelVariant: 'success' as const,
    panelTitle: 'Today is underway',
    panelDescription:
      'The day has started, and more meals can be added whenever you need. Remaining targets help keep the next choice easy to judge.',
  };
}

export default async function TodayPage() {
  const user = await requireCurrentUser();
  const summary = await getTodaySummary(user.id);
  const dayState = getDayState(summary);

  return (
    <Stack gap="xl">
      <section aria-labelledby="today-title">
        <ScreenHeader eyebrow="Today" title="Today" className="mb-5" />

        <DailyBalanceCard
          title="Today"
          eyebrow="Daily home"
          dateLabel={`${summary.dateLabel} · ${dayState.tone}`}
          consumed={summary.consumed}
          targets={summary.targets}
          calorieDelta={summary.remaining.calories}
          mealCount={summary.mealCount}
          confirmedMealCount={summary.confirmedMealCount}
          hasDraftMeals={summary.hasDraftMeals}
          action={
            <Link href="/app/add-meal" className={buttonStyles({ size: 'sm', variant: 'soft' })}>
              Add meal
            </Link>
          }
        />
      </section>

      <section aria-labelledby="macro-progress-heading">
        <ScreenHeader eyebrow="Progress" title="Macros" />

        {summary.targets ? (
          <div className="grid gap-3">
            <MacroProgressRow label="Protein" consumed={summary.consumed.proteinGrams} target={summary.targets.proteinGrams} />
            <MacroProgressRow label="Carbs" consumed={summary.consumed.carbGrams} target={summary.targets.carbGrams} />
            <MacroProgressRow label="Fat" consumed={summary.consumed.fatGrams} target={summary.targets.fatGrams} />
          </div>
        ) : (
          <StatePanel
            variant="empty"
            title="Set targets"
            description="Add your profile to see targets and remaining calories."
            action={
              <Link href="/app/profile" className={buttonStyles({ variant: 'secondary' })}>
                Complete profile
              </Link>
            }
          />
        )}
      </section>

      <section aria-labelledby="today-meals-heading">
        <ScreenHeader eyebrow="Meals" title="Meals" />

        <Stack gap="md">
          {summary.meals.length === 0 ? (
            <Card tone="subtle" className="text-center">
              <p className="text-base font-semibold text-slate-950">No meals yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add your first meal.
              </p>
            </Card>
          ) : (
            summary.meals.map((meal) => <TodayMealListItem key={meal.id} meal={meal} />)
          )}
        </Stack>
      </section>
    </Stack>
  );
}
