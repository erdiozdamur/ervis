'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/icon';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet({ open, onClose, title, description, children, footer }: BottomSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 animate-fade-up">
      <button
        type="button"
        aria-label="Paneli kapat"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[32px] border border-white/70 bg-white/92 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-floating backdrop-blur-2xl animate-slide-up"
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bottom-sheet-title" className="text-lg font-semibold text-slate-950">
              {title}
            </h2>
            {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-soft"
          >
            <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
          </button>
        </div>

        <div className="mt-5 min-h-0 space-y-3 overflow-y-auto pb-1">{children}</div>
        {footer ? <div className="mt-5 border-t border-slate-200/80 pt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
