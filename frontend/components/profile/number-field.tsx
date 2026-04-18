'use client';

import { Input } from '@/components/ui/input';

type NumberFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  placeholder?: string;
  error?: string;
};

export function NumberField({
  id,
  name,
  label,
  defaultValue,
  min,
  max,
  step = 1,
  suffix,
  hint,
  placeholder,
  error,
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {label}
        </label>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type="number"
          defaultValue={defaultValue}
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          placeholder={placeholder}
          className={error ? 'border-rose-300 pr-14 focus:border-rose-500 focus:ring-rose-100' : 'pr-14'}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
