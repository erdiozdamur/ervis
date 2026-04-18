import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type BottomActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function BottomActionBar({ children, className }: BottomActionBarProps) {
  return (
    <div className="pointer-events-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
      <div
        className={cn(
          'mx-auto grid w-full max-w-[28rem] grid-cols-1 gap-3 rounded-[30px] border border-white/85 bg-white/92 p-3 shadow-floating backdrop-blur-2xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
