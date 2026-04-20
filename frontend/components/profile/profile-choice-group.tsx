'use client';

import { cn } from '@/lib/utils/cn';

type Option<T extends string | number> = {
  value: T;
  label: string;
  description: string;
};

type ProfileChoiceGroupProps<T extends string | number> = {
  label: string;
  value?: T;
  name: string;
  options: Array<Option<T>>;
  error?: string;
  columns?: 1 | 2;
  onChange?: (value: T) => void;
};

export function ProfileChoiceGroup<T extends string | number>({
  label,
  value,
  name,
  options,
  error,
  columns = 1,
  onChange,
}: ProfileChoiceGroupProps<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-slate-900">{label}</legend>
      <div className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <label
              key={String(option.value)}
              className={cn(
                'cursor-pointer rounded-[24px] border px-4 py-4 transition',
                isActive
                  ? 'border-slate-950 bg-slate-950 text-white shadow-soft'
                  : 'border-white/70 bg-white/82 text-slate-900 shadow-soft',
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={isActive}
                onChange={() => onChange?.(option.value)}
                className="sr-only"
              />
              <div className="text-sm font-semibold">{option.label}</div>
              <div className={cn('mt-2 text-sm leading-5', isActive ? 'text-white/75' : 'text-slate-600')}>
                {option.description}
              </div>
            </label>
          );
        })}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </fieldset>
  );
}
