import { cn } from '@/lib/utils/cn';

const toneStyles = {
  accent: 'bg-slate-950 text-white',
  neutral: 'bg-white/82 text-slate-950',
  muted: 'bg-slate-100/85 text-slate-950',
} as const;

type StatWidgetProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: keyof typeof toneStyles;
  className?: string;
};

export function StatWidget({ label, value, helper, tone = 'neutral', className }: StatWidgetProps) {
  return (
    <div
      className={cn(
        'hairline rounded-[24px] border border-white/70 p-4 shadow-soft backdrop-blur-xl',
        toneStyles[tone],
        className,
      )}
    >
      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.18em]', tone === 'accent' ? 'text-white/70' : 'text-slate-400')}>
        {label}
      </p>
      <p className="mt-3 text-[1.85rem] font-semibold tracking-tight">{value}</p>
      {helper ? (
        <p className={cn('mt-2 text-sm leading-5', tone === 'accent' ? 'text-white/75' : 'text-slate-600')}>{helper}</p>
      ) : null}
    </div>
  );
}
