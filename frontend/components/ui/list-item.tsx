import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ListItemProps = {
  leading?: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
  className?: string;
};

export function ListItem({ leading, title, description, trailing, className }: ListItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-[26px] border border-white/70 bg-white/82 px-4 py-4 shadow-soft backdrop-blur-xl',
        className,
      )}
    >
      {leading ? (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 shadow-insetSoft">
          {leading}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>

      {trailing ? <div className="shrink-0 text-slate-500">{trailing}</div> : null}
    </div>
  );
}
