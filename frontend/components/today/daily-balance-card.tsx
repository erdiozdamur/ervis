import type { ReactNode } from 'react';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils/cn';
import type { MealTargets, MealTotals } from '@/types/meals';

type DailyBalanceCardProps = {
  title: string;
  eyebrow: string;
  dateLabel: string;
  consumed: MealTotals;
  targets: MealTargets | null;
  calorieDelta: number | null;
  mealCount: number;
  confirmedMealCount: number;
  hasDraftMeals: boolean;
  action?: ReactNode;
};

function getCalorieState(targets: MealTargets | null, calorieDelta: number | null) {
  if (!targets || calorieDelta == null) {
    return {
      badge: 'Tracking live',
      badgeTone: 'neutral' as const,
      heading: 'Tracking is on',
      description: 'Add profile targets to unlock a clearer consumed-versus-target view.',
      deltaLabel: 'Profile target needed',
      progressLabel: 'No target yet',
      fillClass: 'bg-slate-700',
      surfaceClass: 'from-white via-slate-50 to-slate-100/80',
    };
  }

  if (calorieDelta > 250) {
    return {
      badge: 'Room left',
      badgeTone: 'neutral' as const,
      heading: 'Plenty of room left',
      description: 'The next meal can stay simple. You still have comfortable space in today.',
      deltaLabel: `${Math.abs(Math.round(calorieDelta))} kcal left`,
      progressLabel: 'Under target',
      fillClass: 'bg-slate-950',
      surfaceClass: 'from-white via-cyan-50/70 to-slate-50',
    };
  }

  if (calorieDelta > 0) {
    return {
      badge: 'On track',
      badgeTone: 'success' as const,
      heading: 'Nicely on track',
      description: 'You are getting close enough that the rest of the day is easy to judge.',
      deltaLabel: `${Math.abs(Math.round(calorieDelta))} kcal left`,
      progressLabel: 'Close to target',
      fillClass: 'bg-emerald-500',
      surfaceClass: 'from-white via-emerald-50/80 to-cyan-50/70',
    };
  }

  if (calorieDelta === 0) {
    return {
      badge: 'Target met',
      badgeTone: 'success' as const,
      heading: 'Target reached',
      description: 'You have hit the daily calorie target, and edits still remain clear if anything changes.',
      deltaLabel: 'Target met',
      progressLabel: 'At target',
      fillClass: 'bg-emerald-600',
      surfaceClass: 'from-white via-emerald-50/90 to-white',
    };
  }

  return {
    badge: 'Over target',
    badgeTone: 'neutral' as const,
    heading: 'Above target',
    description: 'The overage stays visible without turning the screen into a punishment meter.',
    deltaLabel: `${Math.abs(Math.round(calorieDelta))} kcal over`,
    progressLabel: 'Past target',
    fillClass: 'bg-amber-500',
    surfaceClass: 'from-white via-amber-50/80 to-rose-50/50',
  };
}

export function DailyBalanceCard({
  title,
  eyebrow,
  dateLabel,
  consumed,
  targets,
  calorieDelta,
  mealCount,
  confirmedMealCount,
  hasDraftMeals,
  action,
}: DailyBalanceCardProps) {
  const calorieState = getCalorieState(targets, calorieDelta);
  const progress = targets?.calories ? Math.round((consumed.calories / targets.calories) * 100) : null;
  const clampedProgress = progress == null ? 0 : Math.min(100, Math.max(0, progress));
  const draftCount = mealCount - confirmedMealCount;

  return (
    <div
      className={cn(
        'hairline overflow-hidden rounded-[34px] border border-white/85 bg-gradient-to-br p-5 shadow-soft backdrop-blur-xl',
        calorieState.surfaceClass,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-2 font-display text-4xl leading-none text-slate-950">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{dateLabel}</p>
        </div>
        <StatusPill tone={calorieState.badgeTone}>{calorieState.badge}</StatusPill>
      </div>

      <div className="mt-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Consumed</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-5xl leading-none text-slate-950">{consumed.calories}</span>
            <span className="pb-1 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">kcal</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Target</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {targets ? `${targets.calories} kcal` : 'Set profile'}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{calorieState.heading}</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{calorieState.description}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>{calorieState.progressLabel}</span>
            <span>{calorieState.deltaLabel}</span>
          </div>
          <div className="mt-3 h-3 rounded-full bg-slate-200/80">
            <div
              className={cn('h-3 rounded-full transition-[width] duration-500', calorieState.fillClass)}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
          {progress != null ? (
            <p className="mt-3 text-sm text-slate-500">{Math.max(0, progress)}% of target logged</p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Profile targets unlock remaining calories and clearer daily guidance.</p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-[24px] border border-white/80 bg-white/72 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Macros</p>
          <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
            {consumed.proteinGrams}p · {consumed.carbGrams}c · {consumed.fatGrams}f
          </p>
        </div>
        <div className="rounded-[24px] border border-white/80 bg-white/72 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Meals</p>
          <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{mealCount}</p>
          <p className="mt-1 text-sm text-slate-500">{confirmedMealCount} saved</p>
        </div>
        <div className="rounded-[24px] border border-white/80 bg-white/72 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Drafts</p>
          <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{hasDraftMeals ? draftCount : 0}</p>
          <p className="mt-1 text-sm text-slate-500">{hasDraftMeals ? 'Still editable' : 'All confirmed'}</p>
        </div>
      </div>
    </div>
  );
}
