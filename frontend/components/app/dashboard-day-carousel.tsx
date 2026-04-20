'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type DayChip = {
  dayKey: string;
  weekday: string;
  day: string;
  month: string;
  isToday: boolean;
};

type DashboardDayCarouselProps = {
  todayKey: string;
  dayKey: string;
  dateLabel: string;
  previousDayKey: string;
  nextDayKey: string | null;
  chips: DayChip[];
};

function getDayHref(dayKey: string, todayKey: string): Route {
  return (dayKey === todayKey ? '/app' : `/app?day=${dayKey}`) as Route;
}

export function DashboardDayCarousel({ todayKey, dayKey, dateLabel, previousDayKey, nextDayKey, chips }: DashboardDayCarouselProps) {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  function handleDateChange(value: string) {
    if (!value) {
      return;
    }

    router.push(getDayHref(value, todayKey));
  }

  return (
    <div className="mt-1.5 rounded-[24px] border border-white/75 bg-white/84 p-2.5 shadow-soft backdrop-blur-xl sm:mt-4 sm:rounded-[30px] sm:p-3">
      <div className="flex items-center gap-1 rounded-[18px] bg-white/70 p-1 sm:gap-2 sm:rounded-[24px] sm:p-2">
        {nextDayKey ? (
          <Link
            href={getDayHref(nextDayKey, todayKey)}
            className={buttonStyles({ variant: 'secondary', size: 'icon', className: 'h-9 w-9 rounded-2xl text-xs sm:h-11 sm:w-11 sm:rounded-[20px] sm:text-sm' })}
            aria-label="Daha güncel gün"
          >
            ←
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={buttonStyles({ variant: 'secondary', size: 'icon', className: 'h-9 w-9 rounded-2xl text-xs sm:h-11 sm:w-11 sm:rounded-[20px] sm:text-sm' })}
            aria-label="Daha güncel gün"
          >
            ←
          </button>
        )}

        <button
          type="button"
          onClick={openDatePicker}
          className={cn(
            'min-w-0 flex-1 rounded-2xl px-2 py-1 text-left transition',
            'hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600',
          )}
          aria-label="Takvimi aç"
        >
          <p className="truncate text-[11px] font-semibold text-slate-950 sm:text-sm">{dateLabel}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">Takvim aç</p>
        </button>

        <Link
          href={getDayHref(previousDayKey, todayKey)}
          className={buttonStyles({ variant: 'secondary', size: 'icon', className: 'h-9 w-9 rounded-2xl text-xs sm:h-11 sm:w-11 sm:rounded-[20px] sm:text-sm' })}
          aria-label="Daha geçmiş gün"
        >
          →
        </Link>

        <input
          ref={dateInputRef}
          type="date"
          value={dayKey}
          max={todayKey}
          onChange={(event) => handleDateChange(event.currentTarget.value)}
          className="sr-only"
          aria-label="Tarih seç"
        />
      </div>

      <div className="mt-2 flex snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mt-3 sm:gap-2 sm:pb-1">
        {chips.map((chip) => {
          const isSelected = chip.dayKey === dayKey;

          return (
            <Link
              key={chip.dayKey}
              href={getDayHref(chip.dayKey, todayKey)}
              className={buttonStyles({
                variant: isSelected ? 'primary' : 'soft',
                className: 'h-auto min-w-[3.2rem] snap-start shrink-0 flex-col px-1.5 py-1 sm:min-w-[4.25rem] sm:px-3 sm:py-2.5',
              })}
            >
              <span className="text-[9px] uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.14em]">{chip.isToday ? 'Bugün' : chip.weekday}</span>
              <span className="mt-0.5 text-sm leading-none sm:mt-1 sm:text-base">{chip.day}</span>
              <span className="mt-0.5 hidden text-[9px] uppercase tracking-[0.1em] text-slate-500 sm:mt-1 sm:block sm:text-[10px] sm:tracking-[0.12em]">{chip.month}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
