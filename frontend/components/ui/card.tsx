import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const toneStyles = {
  default: 'border-white/80 bg-white/84 shadow-soft backdrop-blur-xl',
  subtle: 'border-white/70 bg-white/72 shadow-soft backdrop-blur-xl',
  hero: 'border-white/90 bg-white/82 shadow-floating backdrop-blur-2xl',
} as const;

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof toneStyles;
};

export function Card({ className, tone = 'default', ...props }: CardProps) {
  return <div className={cn('hairline rounded-[30px] border p-5', toneStyles[tone], className)} {...props} />;
}
