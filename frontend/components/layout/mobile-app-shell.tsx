import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type MobileAppShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function MobileAppShell({ children, footer, className }: MobileAppShellProps) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 top-40 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl"
      />

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
