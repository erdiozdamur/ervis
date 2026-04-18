import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { formatMealTypeLabel } from '@/lib/meals/constants';
import { cn } from '@/lib/utils/cn';
import type { TodayMealCard } from '@/types/today';

type TodayMealListItemProps = {
  meal: TodayMealCard;
  footer?: ReactNode;
};

export function TodayMealListItem({ meal, footer }: TodayMealListItemProps) {
  return (
    <Card tone="subtle" className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-950">{meal.title}</h3>
            {meal.isDraft ? (
              <StatusPill tone="neutral" className="px-2.5 py-1 text-[10px] tracking-[0.18em]">
                Draft
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {meal.consumedAtLabel} · {meal.itemCount} item{meal.itemCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tracking-tight text-slate-950">{meal.calories} kcal</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{formatMealTypeLabel(meal.mealType)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Protein', value: `${meal.proteinGrams}g` },
          { label: 'Carbs', value: `${meal.carbGrams}g` },
          { label: 'Fat', value: `${meal.fatGrams}g` },
        ].map((macro) => (
          <div key={macro.label} className={cn('rounded-[20px] bg-slate-50 px-3 py-3 text-center')}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{macro.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{macro.value}</p>
          </div>
        ))}
      </div>

      {footer ? <div className="mt-4 border-t border-slate-200/80 pt-3">{footer}</div> : null}
    </Card>
  );
}
