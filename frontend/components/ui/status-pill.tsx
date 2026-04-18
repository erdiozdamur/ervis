import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const toneStyles = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
} as const;

type StatusPillProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof toneStyles;
};

export function StatusPill({ className, tone = 'neutral', ...props }: StatusPillProps) {
  return (
    <div
      className={cn(
        'inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.12em] uppercase',
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
