'use client';

import { ReactNode } from 'react';
import { Command } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

type TopBarProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

export function TopBar({ title, subtitle, rightSlot }: TopBarProps) {
  return (
    <header className="mb-4 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 backdrop-blur md:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Ervis Workspace</p>
          <h1 className="text-lg font-semibold text-white md:text-xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 md:flex">
            <Command size={14} />
            Ervis Command Deck
          </div>
          {rightSlot}
          <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
