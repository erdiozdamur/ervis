import Link from 'next/link';
import type { Route } from 'next';
import { requireCurrentUser } from '@/lib/auth/session';
import { getAppDayKey, isValidAppDayKey, shiftAppDayKey } from '@/lib/date/istanbul';
import { getMealDaySummary } from '@/services/meals/meal-day-service';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MealLogWidget } from '@/components/app/meal-log-widget';
import { MealEditorSheet } from '@/components/meals/meal-editor-sheet';

type DashboardPageProps = {
  searchParams?: {
    day?: string | string[];
  };
};

function resolveDayKey(dayParam: string | string[] | undefined, todayKey: string) {
  const candidate = Array.isArray(dayParam) ? dayParam[0] : dayParam;

  if (!candidate || !isValidAppDayKey(candidate) || candidate > todayKey) {
    return todayKey;
  }

  return candidate;
}

function getDayHref(dayKey: string, todayKey: string): Route {
  return (dayKey === todayKey ? '/app' : `/app?day=${dayKey}`) as Route;
}

function getProgress(consumed: number, target: number | null) {
  if (!target || target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((consumed / target) * 100)));
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireCurrentUser();
  const todayKey = getAppDayKey(new Date());
  const dayKey = resolveDayKey(searchParams?.day, todayKey);
  const summary = await getMealDaySummary(user.id, dayKey);
  const isToday = dayKey === todayKey;
  const previousDayKey = shiftAppDayKey(dayKey, -1);
  const nextDayKey = dayKey < todayKey ? shiftAppDayKey(dayKey, 1) : null;
  const calorieProgress = getProgress(summary.consumed.calories, summary.targets?.calories ?? null);
  const proteinProgress = getProgress(summary.consumed.proteinGrams, summary.targets?.proteinGrams ?? null);
  const carbProgress = getProgress(summary.consumed.carbGrams, summary.targets?.carbGrams ?? null);
  const fatProgress = getProgress(summary.consumed.fatGrams, summary.targets?.fatGrams ?? null);

  return (
    <>
      <MealLogWidget />

      <Stack gap="xl">
        <section aria-labelledby="dashboard-title">
          <ScreenHeader eyebrow="Panel" title="Kalori Takip Paneli" />

          <div className="mt-4 rounded-[28px] border border-white/80 bg-white/80 p-3 shadow-soft backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Link href={getDayHref(previousDayKey, todayKey)} className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                ←
              </Link>

              <div className="min-w-0 flex-1 px-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isToday ? 'Bugün' : 'Seçili gün'}
                </p>
                <p className="truncate text-sm font-semibold text-slate-950">{summary.dateLabel}</p>
              </div>

              {nextDayKey ? (
                <Link href={getDayHref(nextDayKey, todayKey)} className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                  →
                </Link>
              ) : (
                <button type="button" disabled className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                  →
                </button>
              )}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {Array.from({ length: 7 }, (_, index) => shiftAppDayKey(todayKey, -index)).map((date) => (
                <Link
                  key={date}
                  href={getDayHref(date, todayKey)}
                  className={buttonStyles({
                    variant: date === dayKey ? 'primary' : 'soft',
                    size: 'sm',
                    className: 'shrink-0',
                  })}
                >
                  {date === todayKey ? 'Bugün' : date.slice(5)}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="calorie-title">
          <Card tone="hero" className="space-y-4">
            <p id="calorie-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Kalori
            </p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-6xl leading-none text-slate-950">{summary.consumed.calories}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Hedef: {summary.targets?.calories ?? '—'} kcal
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {summary.remaining.calories == null
                  ? 'Hedef ayarla'
                  : summary.remaining.calories >= 0
                    ? `${summary.remaining.calories} kcal kaldı`
                    : `${Math.abs(summary.remaining.calories)} kcal aşıldı`}
              </p>
            </div>
            <div className="h-4 rounded-full bg-slate-200/80">
              <div className="h-4 rounded-full bg-slate-950 transition-all" style={{ width: `${calorieProgress}%` }} />
            </div>
          </Card>
        </section>

        <section aria-labelledby="macro-title">
          <p id="macro-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Makrolar
          </p>
          <div className="mt-3 grid gap-3">
            {[
              {
                label: 'Protein',
                consumed: summary.consumed.proteinGrams,
                target: summary.targets?.proteinGrams ?? null,
                progress: proteinProgress,
                color: 'bg-emerald-500',
              },
              {
                label: 'Karbonhidrat',
                consumed: summary.consumed.carbGrams,
                target: summary.targets?.carbGrams ?? null,
                progress: carbProgress,
                color: 'bg-cyan-500',
              },
              {
                label: 'Yağ',
                consumed: summary.consumed.fatGrams,
                target: summary.targets?.fatGrams ?? null,
                progress: fatProgress,
                color: 'bg-amber-500',
              },
            ].map((macro) => (
              <Card key={macro.label} tone="subtle" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{macro.label}</p>
                  <p className="text-sm text-slate-600">
                    {macro.consumed} / {macro.target ?? '—'} g
                  </p>
                </div>
                <div className="h-3 rounded-full bg-slate-200/70">
                  <div className={`h-3 rounded-full ${macro.color} transition-all`} style={{ width: `${macro.progress}%` }} />
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="meals-title">
          <div className="flex items-center justify-between gap-3">
            <ScreenHeader eyebrow="Öğünler" title="Günlük öğünler" />
            {summary.targets ? null : (
              <Link href="/app/profile" className={buttonStyles({ size: 'sm', variant: 'secondary' })}>
                Hedef ayarla
              </Link>
            )}
          </div>

          <Stack gap="md">
            {summary.meals.length === 0 ? (
              <Card tone="subtle" className="text-center">
                <p className="text-base font-semibold text-slate-950">Bu gün için kayıt yok</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Sağ alttaki + ile öğün ekle.</p>
              </Card>
            ) : (
              summary.meals.map((meal) => (
                <Card key={meal.id} tone="subtle">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{meal.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {meal.consumedAtLabel} · {meal.itemCount} besin
                      </p>
                    </div>
                    <p className="text-lg font-semibold tracking-tight text-slate-950">{meal.calories} kcal</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-[18px] bg-slate-100 px-3 py-2 text-center text-sm">{meal.proteinGrams}p</div>
                    <div className="rounded-[18px] bg-slate-100 px-3 py-2 text-center text-sm">{meal.carbGrams}k</div>
                    <div className="rounded-[18px] bg-slate-100 px-3 py-2 text-center text-sm">{meal.fatGrams}y</div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <MealEditorSheet mealId={meal.id} isDraft={meal.isDraft} />
                  </div>
                </Card>
              ))
            )}
          </Stack>
        </section>
      </Stack>
    </>
  );
}
