import Link from 'next/link';
import { requireCurrentUser } from '@/lib/auth/session';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getAppDayDateFromDayKey, getAppDayKey, isValidAppDayKey, shiftAppDayKey } from '@/lib/date/istanbul';
import { getMealDaySummary } from '@/services/meals/meal-day-service';
import { Stack } from '@/components/layout/stack';
import { ScreenHeader } from '@/components/layout/screen-header';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MealLogWidget } from '@/components/app/meal-log-widget';
import { DashboardDayCarousel } from '@/components/app/dashboard-day-carousel';
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
  const previousDayKey = shiftAppDayKey(dayKey, -1);
  const nextDayKey = dayKey < todayKey ? shiftAppDayKey(dayKey, 1) : null;
  const calorieProgress = getProgress(summary.consumed.calories, summary.targets?.calories ?? null);
  const proteinProgress = getProgress(summary.consumed.proteinGrams, summary.targets?.proteinGrams ?? null);
  const carbProgress = getProgress(summary.consumed.carbGrams, summary.targets?.carbGrams ?? null);
  const fatProgress = getProgress(summary.consumed.fatGrams, summary.targets?.fatGrams ?? null);
  const daySelection = Array.from({ length: 30 }, (_, index) => shiftAppDayKey(todayKey, -index));
  const dayChips = daySelection.map((dayKeyValue) => {
    const chip = formatDayChip(dayKeyValue);
    return {
      dayKey: dayKeyValue,
      weekday: chip.weekday,
      day: chip.day,
      month: chip.month,
      isToday: dayKeyValue === todayKey,
    };
  });
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

      <Stack gap="sm">
        <section aria-labelledby="dashboard-title">
          <div className="mb-0.5 sm:mb-4">
            <ScreenHeader eyebrow="Panel" title="Kalori Takip Paneli" className="mb-0 hidden sm:block" />
          </div>

          <DashboardDayCarousel
            todayKey={todayKey}
            dayKey={dayKey}
            dateLabel={summary.dateLabel}
            previousDayKey={previousDayKey}
            nextDayKey={nextDayKey}
            chips={dayChips}
          />
        </section>

        <section aria-labelledby="calorie-title">
          <Card tone="hero" className="space-y-2.5 p-4 sm:space-y-5 sm:p-5">
            <p id="calorie-title" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
              Kalori
            </p>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[1.2fr_auto] md:gap-6">
              <div>
                <div className="flex items-end gap-2">
                  <p className="font-display text-[1.8rem] leading-none text-slate-950 sm:text-6xl">{summary.consumed.calories}</p>
                  <p className="pb-0.5 text-xs text-slate-500 sm:pb-1 sm:text-sm">kcal</p>
                </div>
                <p className="mt-1 text-xs text-slate-600 sm:mt-2 sm:text-sm">Hedef: {calorieGoal ?? '—'} kcal</p>
                <p className="mt-1 text-xs font-semibold text-slate-700 sm:mt-4 sm:text-sm">{caloriesLeftLabel}</p>
              </div>

              <div className="mx-auto flex h-[96px] w-[96px] items-center justify-center rounded-full bg-white/70 shadow-insetSoft sm:h-[168px] sm:w-[168px]">
                <div className="relative flex h-[86px] w-[86px] items-center justify-center sm:h-[150px] sm:w-[150px]">
                  <div className="sm:hidden">
                    <ProgressRing progress={calorieProgress} size={86} strokeWidth={6} color="#0f172a" />
                  </div>
                  <div className="hidden sm:block">
                    <ProgressRing progress={calorieProgress} size={150} strokeWidth={12} color="#0f172a" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[15px] font-semibold tracking-tight text-slate-950 sm:text-3xl">{calorieProgress}%</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-slate-500 sm:mt-1 sm:text-[11px] sm:tracking-[0.14em]">Tamamlandı</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-2 rounded-full bg-slate-200/80 sm:h-3">
              <div className="h-2 rounded-full bg-slate-950 transition-all sm:h-3" style={{ width: `${calorieProgress}%` }} />
            </div>
          </Card>
        </section>

        <section aria-labelledby="macro-title">
          <p id="macro-title" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
            Makrolar
          </p>
          <Card tone="subtle" className="mt-2 p-3 sm:mt-3 sm:p-5">
            <div className="grid grid-cols-3 divide-x divide-slate-200/70 rounded-2xl bg-white/72 sm:grid-cols-1 sm:gap-3 sm:divide-x-0 sm:rounded-none sm:bg-transparent">
              {macroCards.map((macro) => (
                <div key={macro.label} className="space-y-1.5 px-2 py-2 sm:space-y-3 sm:rounded-[24px] sm:bg-white/78 sm:p-6">
                  <p className="text-xs font-semibold text-slate-900 sm:text-sm">{macro.label}</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500 sm:text-xs sm:tracking-[0.12em]">{macro.remaining.replace(' kaldı', '')}</p>

                  <div className="flex items-end justify-between gap-1.5 text-[11px] text-slate-600 sm:gap-3 sm:text-sm">
                    <p>
                      {macro.consumed} / {macro.target ?? '—'} g
                    </p>
                    <p className="text-[10px] font-semibold sm:text-xs" style={{ color: macro.color }}>
                      {macro.progress}%
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/75 sm:h-2.5">
                    <div className="h-2 rounded-full transition-all sm:h-2.5" style={{ width: `${macro.progress}%`, backgroundColor: macro.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
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
                <MealEditorSheet key={meal.id} mealId={meal.id} isDraft={meal.isDraft} triggerClassName="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-[30px]">
                  <Card tone="subtle" className="transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{meal.title}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-700">
                          {meal.previewItemNames.length > 0 ? meal.previewItemNames.join(' · ') : 'Besin bulunamadı'}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-slate-100 px-3 py-2 text-right">
                        <p className="text-base font-semibold tracking-tight text-slate-950">{meal.calories}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">kcal</p>
                      </div>
                    </div>
                  </Card>
                </MealEditorSheet>
              ))
            )}
          </Stack>
        </section>
      </Stack>
    </>
  );
}
