import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

const variantMap = {
  empty: {
    icon: 'today',
    badge: 'Ready for first entry',
    iconWrap: 'bg-slate-100 text-slate-800',
  },
  loading: {
    icon: 'spark',
    badge: 'Working gently',
    iconWrap: 'bg-cyan-50 text-cyan-700',
  },
  error: {
    icon: 'warning',
    badge: 'Needs recovery',
    iconWrap: 'bg-rose-50 text-rose-700',
  },
  success: {
    icon: 'check',
    badge: 'Looks good',
    iconWrap: 'bg-emerald-50 text-emerald-700',
  },
} as const satisfies Record<string, { icon: IconName; badge: string; iconWrap: string }>;

type StatePanelProps = {
  variant: keyof typeof variantMap;
  title: string;
  description: string;
  action?: ReactNode;
  aside?: ReactNode;
};

export function StatePanel({ variant, title, description, action, aside }: StatePanelProps) {
  const config = variantMap[variant];

  return (
    <Card tone="subtle" className="overflow-hidden">
      <div className="flex items-start gap-4">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px]', config.iconWrap)}>
          <Icon
            name={config.icon}
            className={cn('h-5 w-5', variant === 'loading' ? 'animate-pulse-soft' : undefined)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{config.badge}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>

        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </Card>
  );
}
