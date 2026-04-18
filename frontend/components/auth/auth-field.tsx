'use client';

import type { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function AuthField({ label, hint, error, className, id, ...props }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {label}
        </label>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>

      <Input
        id={id}
        className={cn(error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : '', className)}
        aria-invalid={Boolean(error)}
        {...props}
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
