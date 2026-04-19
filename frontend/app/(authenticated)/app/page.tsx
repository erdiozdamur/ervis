import Link from 'next/link';
import type { Route } from 'next';
import { requireCurrentUser } from '@/lib/auth/session';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getAppDayDateFromDayKey, getAppDayKey, isValidAppDayKey, shiftAppDayKey } from '@/lib/date/istanbul';
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

type ProgressRingProps = {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
};

const weekdayFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  weekday: 'short',
});

const dayFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  day: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: DEFAULT_APP_TIME_ZONE,
  month: 'short',
});

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

function formatDayChip(dayKey: string) {
  const date = getAppDayDateFromDayKey(dayKey);

  return {
    weekday: weekdayFormatter.format(date).replace('.', ''),
    day: dayFormatter.format(date),
    month: monthFormatter.format(date).replace('.', ''),
  };
}

function getRemainingLabel(value: number | null, suffix: string) {
  if (value == null) {
    return 'Hedef yok';
  }

  if (value >= 0) {
    return `${Math.round(value)} ${suffix} kaldı`;
  }

  return `${Math.abs(Math.round(value))} ${suffix} aşıldı`;
}

function ProgressRing({ progress, size, strokeWidth, color, trackColor = 'rgba(148, 163, 184, 0.22)' }: ProgressRingProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeProgress / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 240ms ease' }}
      />
    </svg>
  );
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
  const daySelection = Array.from({ length: 14 }, (_, index) => shiftAppDayKey(todayKey, -index));
  const calorieGoal = summary.targets?.calories ?? null;
  const caloriesLeftLabel = getRemainingLabel(summary.remaining.calories, 'kcal');
  const macroCards = [
    {
      label: 'Protein',
      consumed: summary.consumed.proteinGrams,
      target: summary.targets?.proteinGrams ?? null,
      progress: proteinProgress,
      remaining: getRemainingLabel(summary.remaining.proteinGrams, 'g'),
      color: '#10b981',
    },
    {
      label: 'Karbonhidrat',
      consumed: summary.consumed.carbGrams,
      target: summary.targets?.carbGrams ?? null,
      progress: carbProgress,
      remaining: getRemainingLabel(summary.remaining.carbGrams, 'g'),
      color: '#06b6d4',
    },
    {
      label: 'Yağ',
      consumed: summary.consumed.fatGrams,
      target: summary.targets?.fatGrams ?? null,
      progress: fatProgress,
      remaining: getRemainingLabel(summary.remaining.fatGrams, 'g'),
      color: '#f59e0b',
    },
  ] as const;

  return (
    <>
      <MealLogWidget />

      <Stack gap="xl">
        <section aria-labelledby="dashboard-title">
          <ScreenHeader eyebrow="Panel" title="Kalori Takip Paneli" />

          <div className="mt-4 rounded-[30px] border border-white/80 bg-white/85 p-3 shadow-soft backdrop-blur-xl">
            <div className="flex items-center gap-2 rounded-[24px] bg-white/70 p-2">
              <Link href={getDayHref(previousDayKey, todayKey)} className={buttonStyles({ variant: 'secondary', size: 'icon' })}>
                ←
              </Link>

              <div className="min-w-0 flex-1 px-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isToday ? 'Bugün' : 'Seçili gün'}</p>
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
              {daySelection.map((date) => {
                const chip = formatDayChip(date);
                const isSelected = date === dayKey;

                return (
                  <Link
                    key={date}
                    href={getDayHref(date, todayKey)}
                    className={buttonStyles({
                      variant: isSelected ? 'primary' : 'soft',
                      className: 'h-auto min-w-[4.25rem] shrink-0 flex-col px-3 py-2.5',
                    })}
                  >
                    <span className="text-[10px] uppercase tracking-[0.14em]">{date === todayKey ? 'Bugün' : chip.weekday}</span>
                    <span className="mt-1 text-base leading-none">{chip.day}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.12em]">{chip.month}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="calorie-title">
          <Card tone="hero" className="space-y-5">
            <p id="calorie-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Kalori
            </p>

            <div className="grid gap-6 md:grid-cols-[1.2fr_auto] md:items-center">
              <div>
                <div className="flex items-end gap-2">
                  <p className="font-display text-6xl leading-none text-slate-950">{summary.consumed.calories}</p>
                  <p className="pb-1 text-sm text-slate-500">kcal</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">Hedef: {calorieGoal ?? '—'} kcal</p>
                <p className="mt-4 text-sm font-semibold text-slate-700">{caloriesLeftLabel}</p>
              </div>

              <div className="mx-auto flex h-[168px] w-[168px] items-center justify-center rounded-full bg-white/70 shadow-insetSoft">
                <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                  <ProgressRing progress={calorieProgress} size={150} strokeWidth={12} color="#0f172a" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-3xl font-semibold tracking-tight text-slate-950">{calorieProgress}%</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Tamamlandı</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-3 rounded-full bg-slate-200/80">
              <div className="h-3 rounded-full bg-slate-950 transition-all" style={{ width: `${calorieProgress}%` }} />
            </div>
          </Card>
        </section>

        <section aria-labelledby="macro-title">
          <p id="macro-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Makrolar
          </p>
          <div className="mt-3 grid gap-3">
            {macroCards.map((macro) => (
              <Card key={macro.label} tone="subtle" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{macro.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{macro.remaining}</p>
                  </div>

                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <ProgressRing progress={macro.progress} size={48} strokeWidth={5} color={macro.color} />
                    <span className="absolute text-[11px] font-semibold text-slate-700">{macro.progress}%</span>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3 text-sm text-slate-600">
                  <p>
                    {macro.consumed} / {macro.target ?? '—'} g
                  </p>
                  <p className="font-medium text-slate-800">Hedef {macro.target ?? '—'} g</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200/75">
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${macro.progress}%`, backgroundColor: macro.color }} />
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
