'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mealTypeOptions } from '@/lib/meals/constants';
import { flattenMealFieldErrors, mealUpdateSchema } from '@/lib/meals/validation';
import { cn } from '@/lib/utils/cn';
import type { MealCard, MealDeleteResult, MealUpdateFieldErrors, MealUpdateResult } from '@/types/meals';

type HistoryMealSheetProps = {
  dayKey: string;
  meal: MealCard;
};

export function HistoryMealSheet({ dayKey, meal }: HistoryMealSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(meal.title);
  const [mealType, setMealType] = useState(meal.mealType);
  const [consumedTime, setConsumedTime] = useState(meal.consumedAtValue);
  const [notes, setNotes] = useState(meal.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<MealUpdateFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setTitle(meal.title);
    setMealType(meal.mealType);
    setConsumedTime(meal.consumedAtValue);
    setNotes(meal.notes ?? '');
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);
    setConfirmDelete(false);
  }

  function handleOpen() {
    resetState();
    setOpen(true);
  }

  function handleClose() {
    if (isPending) {
      return;
    }

    setOpen(false);
    resetState();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    const parsed = mealUpdateSchema.safeParse({
      dayKey,
      title,
      mealType,
      consumedTime,
      notes,
    });

    if (!parsed.success) {
      setFieldErrors(flattenMealFieldErrors(parsed.error) as MealUpdateFieldErrors);
      setFormError('A few meal details need attention before this can be saved.');
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as MealUpdateResult | null;

      if (!response.ok || !payload?.ok) {
        setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
        setFormError(payload?.ok === false ? payload.message : 'The meal could not be updated. Please try again.');
        return;
      }

      setFormSuccess('Meal details updated.');
      router.refresh();
    });
  }

  function handleDelete() {
    if (isPending) {
      return;
    }

    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/meals/${meal.id}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as MealDeleteResult | null;

      if (!response.ok || !payload?.ok) {
        setFormError(payload?.ok === false ? payload.message : 'The meal could not be deleted. Please try again.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
        Edit
      </button>

      <BottomSheet
        open={open}
        onClose={handleClose}
        title={meal.title}
        description={
          meal.isDraft
            ? 'Edit draft or open full draft review.'
            : 'Edit meal info or open item editor.'
        }
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={isPending}>
              Close
            </Button>
            <Button type="submit" form={`meal-edit-${meal.id}`} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <form id={`meal-edit-${meal.id}`} className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm font-semibold text-slate-900">{meal.isDraft ? 'Need item edits?' : 'Need item edits?'}</p>
            <Link
              href={(meal.isDraft ? `/app/add-meal/review/${meal.id}` : `/app/meals/${meal.id}/edit`) as Route}
              className={buttonStyles({ variant: 'secondary', className: 'mt-4 w-full' })}
              onClick={() => setOpen(false)}
            >
              {meal.isDraft ? 'Open draft review' : 'Open full meal editor'}
            </Link>
          </div>

          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
          ) : null}

          {formSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {formSuccess}
            </div>
          ) : null}

          <div>
            <label htmlFor={`meal-title-${meal.id}`} className="text-sm font-semibold text-slate-900">
              Meal title
            </label>
            <Input
              id={`meal-title-${meal.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2"
              placeholder="Dinner with friends"
              maxLength={120}
            />
            {fieldErrors.title ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.title}</p> : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Meal type</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {mealTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMealType(option.value)}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-left transition',
                    mealType === option.value
                      ? 'border-slate-950 bg-slate-950 text-white shadow-soft'
                      : 'border-slate-200 bg-white text-slate-800 shadow-soft',
                  )}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className={cn('mt-1 text-xs leading-5', mealType === option.value ? 'text-white/75' : 'text-slate-500')}>
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
            {fieldErrors.mealType ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.mealType}</p> : null}
          </div>

          <div>
            <label htmlFor={`meal-time-${meal.id}`} className="text-sm font-semibold text-slate-900">
              Time on this day
            </label>
            <Input
              id={`meal-time-${meal.id}`}
              type="time"
              value={consumedTime}
              onChange={(event) => setConsumedTime(event.target.value)}
              className="mt-2"
            />
            {fieldErrors.consumedTime ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.consumedTime}</p> : null}
          </div>

          <div>
            <label htmlFor={`meal-notes-${meal.id}`} className="text-sm font-semibold text-slate-900">
              Notes
            </label>
            <Textarea
              id={`meal-notes-${meal.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2"
              placeholder="Optional note"
              maxLength={600}
            />
            {fieldErrors.notes ? <p className="mt-2 text-sm text-rose-600">{fieldErrors.notes}</p> : null}
          </div>

          <div className="rounded-[24px] border border-rose-200/70 bg-rose-50/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rose-900">Delete this meal</p>
                <p className="mt-2 text-sm leading-6 text-rose-700">Removes this meal from the day.</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete((current) => !current)}
                className={buttonStyles({
                  variant: 'secondary',
                  size: 'sm',
                  className: 'border-rose-200 text-rose-700 hover:bg-rose-100',
                })}
              >
                {confirmDelete ? 'Cancel' : 'Delete'}
              </button>
            </div>

            {confirmDelete ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-950">Final check</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">This action cannot be undone.</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full border-rose-200 text-rose-700 hover:bg-rose-100"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? 'Deleting...' : 'Delete meal permanently'}
                </Button>
              </div>
            ) : null}
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
