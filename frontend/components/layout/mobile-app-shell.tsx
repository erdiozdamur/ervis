import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type MobileAppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function MobileAppShell({ children, footer, className }: MobileAppShellProps) {
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <main
        className={cn(
          'relative z-10 mx-auto flex min-h-screen w-full max-w-[28rem] flex-col px-4 pb-36 pt-5 sm:px-6',
          className,
        )}
      >
        {children}
      </main>

      {footer ? <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">{footer}</div> : null}
    </div>
  );
}
