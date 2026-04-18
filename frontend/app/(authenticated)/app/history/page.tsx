import type { Route } from 'next';
import Link from 'next/link';
import { HistoryMealSheet } from '@/components/history/history-meal-sheet';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { TodayMealListItem } from '@/components/today/today-meal-list-item';
import { DailyBalanceCard } from '@/components/today/daily-balance-card';
import { MacroProgressRow } from '@/components/today/macro-progress-row';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatePanel } from '@/components/ui/state-panel';
import { requireCurrentUser } from '@/lib/auth/session';
import { getAppDayKey, isValidAppDayKey, shiftAppDayKey } from '@/lib/date/istanbul';
import { getMealDaySummary } from '@/services/meals/meal-day-service';

type HistoryPageProps = {
  searchParams?: {
    day?: string | string[];
  };
};

function resolveSelectedDayKey(dayParam: string | string[] | undefined, todayKey: string) {
  const candidate = Array.isArray(dayParam) ? dayParam[0] : dayParam;

  if (!candidate || !isValidAppDayKey(candidate) || candidate > todayKey) {
    return todayKey;
  }

  return candidate;
}

function getDayHref(dayKey: string, todayKey: string): Route {
  return (dayKey === todayKey ? '/app/history' : `/app/history?day=${dayKey}`) as Route;
}

function getRecentDayKeys(todayKey: string) {
  return Array.from({ length: 7 }, (_, index) => shiftAppDayKey(todayKey, -index));
}

function getSelectedDayTone(selectedDayKey: string, todayKey: string) {
  if (selectedDayKey === todayKey) {
    return {
      label: 'Today',
      description: 'Live view',
    };
  }

  if (selectedDayKey === shiftAppDayKey(todayKey, -1)) {
    return {
      label: 'Yesterday',
      description: 'Past day',
    };
  }

  return {
    label: 'History',
    description: 'Past day',
  };
}

function getHistoryState(summary: Awaited<ReturnType<typeof getMealDaySummary>>, isToday: boolean) {
  if (summary.mealCount === 0) {
    return {
      variant: 'empty' as const,
      title: isToday ? 'Today is still open and ready for the first meal' : 'No meals were saved for this day',
      description: isToday
        ? 'History still opens on today, but you can move backward one day at a time whenever you want to review older entries.'
        : 'This day is part of your history timeline, but there are no meals saved here yet. Use the day controls to move without losing context.',
    };
  }

  if (summary.hasDraftMeals) {
    return {
      variant: 'success' as const,
      title: 'This day includes editable draft meals',
      description:
        'Drafts remain visible in history so you can clean them up later without mixing them up with fully confirmed days.',
    };
  }

  return {
    variant: 'success' as const,
    title: isToday ? 'Today is already taking shape' : 'This day is fully readable at a glance',
    description: isToday
      ? 'The live day stays easy to scan, and the same structure carries into older days so nothing feels mentally different when you look back.'
      : 'Meals, totals, and macro coverage stay grouped into the same Istanbul-local day bucket for a calm review flow.',
  };
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const user = await requireCurrentUser();
  const todayKey = getAppDayKey(new Date());
  const selectedDayKey = resolveSelectedDayKey(searchParams?.day, todayKey);
  const summary = await getMealDaySummary(user.id, selectedDayKey);
  const recentDayKeys = getRecentDayKeys(todayKey);
  const previousDayKey = shiftAppDayKey(selectedDayKey, -1);
  const nextDayKey = selectedDayKey < todayKey ? shiftAppDayKey(selectedDayKey, 1) : null;
  const isToday = selectedDayKey === todayKey;
  const dayTone = getSelectedDayTone(selectedDayKey, todayKey);
  const historyState = getHistoryState(summary, isToday);

  return (
    <Stack gap="xl">
      <section aria-labelledby="history-title">
        <ScreenHeader eyebrow="History" title="History" />
      </section>

      <section aria-labelledby="history-day-nav">
        <div className="sticky top-20 z-10 -mx-1 rounded-[28px] border border-white/80 bg-white/78 p-3 shadow-soft backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Link href={getDayHref(previousDayKey, todayKey)} className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
              <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
              <span className="sr-only">Previous day</span>
            </Link>

            <div className="min-w-0 flex-1 px-2">
              <p id="history-day-nav" className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                {dayTone.description}
              </p>
              <p className="truncate text-sm font-semibold text-slate-950">{summary.dateLabel}</p>
            </div>

            {nextDayKey ? (
              <Link href={getDayHref(nextDayKey, todayKey)} className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                <Icon name="chevronRight" className="h-4 w-4" />
                <span className="sr-only">Next day</span>
              </Link>
            ) : (
              <button type="button" disabled className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                <Icon name="chevronRight" className="h-4 w-4" />
                <span className="sr-only">Next day unavailable</span>
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {recentDayKeys.map((dayKey) => {
              const isSelected = dayKey === selectedDayKey;
              const isRecentToday = dayKey === todayKey;

              return (
                <Link
                  key={dayKey}
                  href={getDayHref(dayKey, todayKey)}
                  className={buttonStyles({
                    variant: isSelected ? 'primary' : 'soft',
                    size: 'sm',
                    className: 'shrink-0',
                  })}
                >
                  {isRecentToday ? 'Today' : dayKey === shiftAppDayKey(todayKey, -1) ? 'Yesterday' : dayKey.slice(5)}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <DailyBalanceCard
            title={dayTone.label}
            eyebrow="Selected day"
            dateLabel={
              isToday
                ? `${summary.dateLabel} · History stays anchored to today first`
                : `${summary.dateLabel} · Past day view`
            }
            consumed={summary.consumed}
            targets={summary.targets}
            calorieDelta={summary.remaining.calories}
            mealCount={summary.mealCount}
            confirmedMealCount={summary.confirmedMealCount}
            hasDraftMeals={summary.hasDraftMeals}
            action={
              <div className="flex shrink-0 gap-2">
                {!isToday ? (
                  <Link href="/app/history" className={buttonStyles({ size: 'sm', variant: 'secondary' })}>
                    Today
                  </Link>
                ) : null}
                <Link href="/app/add-meal" className={buttonStyles({ size: 'sm', variant: 'soft' })}>
                  Add meal
                </Link>
              </div>
            }
          />
        </div>
      </section>

      <section aria-labelledby="history-progress-heading">
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
            description="Add profile targets for daily comparisons."
            action={
              <Link href="/app/profile" className={buttonStyles({ variant: 'secondary' })}>
                Complete profile
              </Link>
            }
          />
        )}
      </section>

      <section aria-labelledby="history-state">
        <StatePanel
          variant={historyState.variant}
          title={historyState.title}
          description={historyState.description}
          action={
            <Link href={isToday ? '/app/add-meal' : '/app/history'} className={buttonStyles({ variant: 'secondary' })}>
              {isToday ? 'Add a meal' : 'Return to today'}
            </Link>
          }
        />
      </section>

      <section aria-labelledby="history-meals-heading">
        <ScreenHeader eyebrow="Meals" title="Meals" />

        <Stack gap="md">
          {summary.meals.length === 0 ? (
            <Card tone="subtle" className="text-center">
              <p className="text-base font-semibold text-slate-950">No meals for this day</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Choose another day or go back to today.</p>
            </Card>
          ) : (
            summary.meals.map((meal) => (
              <TodayMealListItem
                key={meal.id}
                meal={meal}
                footer={
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{meal.isDraft ? 'Draft meal' : 'Saved meal'}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {meal.notes ? meal.notes : 'You can adjust title, meal type, notes, or time from here.'}
                      </p>
                    </div>
                    <HistoryMealSheet dayKey={summary.dayKey} meal={meal} />
                  </div>
                }
              />
            ))
          )}
        </Stack>
      </section>
    </Stack>
  );
}
