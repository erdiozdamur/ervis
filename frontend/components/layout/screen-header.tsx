import { cn } from '@/lib/utils/cn';

type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
};

export function ScreenHeader({ eyebrow, title, description, className }: ScreenHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
      <h2 className="mt-2 text-[1.85rem] font-semibold tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}
