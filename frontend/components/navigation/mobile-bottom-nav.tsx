'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { appNavigationItems } from '@/lib/app/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

export function MobileBottomNav() {
  const pathname = usePathname();
  const columnClass = appNavigationItems.length === 2 ? 'grid-cols-2' : 'grid-cols-4';

  return (
    <nav aria-label="Primary" className="pointer-events-auto px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
      <div className={cn('mx-auto grid max-w-[28rem] items-end gap-2 rounded-[30px] border border-white/85 bg-white/92 p-2 shadow-floating backdrop-blur-2xl', columnClass)}>
        {appNavigationItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[24px] px-2 py-2 text-[11px] font-semibold transition duration-200',
                isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
