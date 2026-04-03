'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DrawerShellProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function DrawerShell({ open, title, subtitle, onClose, children, footer }: DrawerShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[1040px] flex-col border-l border-white/20 bg-slate-950/95 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
              {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
            </div>
            <Button type="button" variant="secondary" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
          <div className="space-y-5">{children}</div>
        </div>

        {footer ? (
          <footer className="sticky bottom-0 border-t border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

type DrawerSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DrawerSection({ title, description, children }: DrawerSectionProps) {
  return (
    <section className="rounded-2xl border border-white/12 bg-slate-900/60 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
