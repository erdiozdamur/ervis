'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Command, LayoutDashboard, Menu, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { href: '/settings' as const, label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full flex-col border-r border-white/10 bg-slate-950/85 px-4 py-4 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="group flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/15 text-cyan-300">
            <Bot size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Ervis</div>
            <div className="text-[11px] text-slate-400">Autonomous Workspace</div>
          </div>
        </Link>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X size={16} />
        </Button>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={15} className={cn(active ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/12 bg-white/5 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
          <Command size={14} />
          Command Deck
        </div>
        <p className="text-xs text-slate-400">
          Yakında: global komutlar, hızlı aksiyonlar ve kısayol tabanlı yönetim.
        </p>
      </div>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        className="fixed left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-slate-900/85 text-slate-100 shadow lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={16} />
      </button>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-72 transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebar}
      </div>

      <div className="hidden h-screen w-72 lg:sticky lg:top-0 lg:block">{sidebar}</div>
    </>
  );
}
