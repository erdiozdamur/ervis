import { cn } from '@/lib/utils/cn';

type MacroProgressRowProps = {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
};

export function MacroProgressRow({ label, consumed, target, unit = 'g' }: MacroProgressRowProps) {
  const accentMap = {
    Protein: {
      dot: 'bg-cyan-500',
      track: 'bg-cyan-100',
      fill: 'bg-cyan-500',
      badge: 'text-cyan-700',
    },
    Carbs: {
      dot: 'bg-amber-500',
      track: 'bg-amber-100',
      fill: 'bg-amber-500',
      badge: 'text-amber-700',
    },
    Fat: {
      dot: 'bg-rose-500',
      track: 'bg-rose-100',
      fill: 'bg-rose-500',
      badge: 'text-rose-700',
    },
  } as const;

  const accent = accentMap[label as keyof typeof accentMap] ?? accentMap.Protein;
  const progress = target > 0 ? Math.round((consumed / target) * 100) : 0;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const delta = Math.round(target - consumed);
  const stateLabel = delta > 0 ? `${delta}${unit} left` : delta === 0 ? 'Target met' : `${Math.abs(delta)}${unit} over`;
  const stateTone = delta < 0 ? 'text-amber-700' : delta === 0 ? 'text-emerald-700' : accent.badge;

  return (
    <div className="hairline rounded-[26px] border border-white/70 bg-white/82 p-4 shadow-soft backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={cn('h-2.5 w-2.5 rounded-full', accent.dot)} />
            <p className="text-sm font-semibold text-slate-950">{label}</p>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {consumed}
            <span className="ml-1 text-sm font-medium uppercase tracking-[0.16em] text-slate-500">{unit}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Target {target}
            {unit}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-semibold', stateTone)}>{stateLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{Math.max(0, progress)}% logged</p>
        </div>
      </div>

      <div className={cn('mt-4 h-2.5 rounded-full', accent.track)}>
        <div
          className={cn(
            'h-2.5 rounded-full transition-[width] duration-500',
            delta < 0 ? 'bg-amber-500' : delta === 0 ? 'bg-emerald-600' : accent.fill,
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
