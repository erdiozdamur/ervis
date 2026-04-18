import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const gapMap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;

type StackProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  gap?: keyof typeof gapMap;
};

export function Stack({ children, className, gap = 'md', ...props }: StackProps) {
  return (
    <div className={cn('flex flex-col', gapMap[gap], className)} {...props}>
      {children}
    </div>
  );
}
