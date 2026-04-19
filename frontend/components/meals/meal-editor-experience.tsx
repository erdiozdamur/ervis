'use client';

import type { Route } from 'next';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomActionBar } from '@/components/layout/bottom-action-bar';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { StatWidget } from '@/components/ui/stat-widget';
import { StatusPill } from '@/components/ui/status-pill';
import { Textarea } from '@/components/ui/textarea';
import { getAppDayKey } from '@/lib/date/istanbul';
import { finalMealUpdateSchema, flattenFinalMealFieldErrors } from '@/lib/meals/final-meal-validation';
import { mealTypeOptions } from '@/lib/meals/constants';
import { cn } from '@/lib/utils/cn';
import type { MealDeleteResult, MealEditorSnapshot, MealSaveFieldErrors, MealSaveResult } from '@/types/meals';

type EditableMealItemState = {
  id: string;
  displayName: string;
  quantityAmount: string;
  quantityUnit: string;
  gramsEstimate: string;
  calories: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  fiberGrams: string;
};

type MealEditorExperienceProps = {
  initialMeal: MealEditorSnapshot;
};

function createEditableItems(meal: MealEditorSnapshot): EditableMealItemState[] {
  return meal.items.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    quantityAmount: item.quantityAmount != null ? String(item.quantityAmount) : '',
    quantityUnit: item.quantityUnit ?? '',
    gramsEstimate: item.gramsEstimate != null ? String(item.gramsEstimate) : '',
    calories: String(item.calories),
    proteinGrams: String(item.proteinGrams),
    carbGrams: String(item.carbGrams),
    fatGrams: String(item.fatGrams),
    fiberGrams: String(item.fiberGrams),
  }));
}

function createSnapshot({
  dayKey,
  title,
  mealType,
  consumedTime,
  notes,
  items,
}: {
  dayKey: string;
  title: string;
  mealType: MealEditorSnapshot['mealType'];
  consumedTime: string;
  notes: string;
  items: EditableMealItemState[];
}) {
  return JSON.stringify({
    dayKey,
    title,
    mealType,
    consumedTime,
    notes,
    items,
  });
}

function makeItemId() {
  return `meal-item-${Math.random().toString(36).slice(2, 10)}`;
}

function sumTotals(items: EditableMealItemState[]) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + (Number(item.calories) || 0),
      proteinGrams: totals.proteinGrams + (Number(item.proteinGrams) || 0),
      carbGrams: totals.carbGrams + (Number(item.carbGrams) || 0),
      fatGrams: totals.fatGrams + (Number(item.fatGrams) || 0),
    }),
    {
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
    },
  );
}

export function MealEditorExperience({ initialMeal }: MealEditorExperienceProps) {
  const router = useRouter();
  const [dayKey] = useState(initialMeal.dayKey);
  const [title, setTitle] = useState(initialMeal.title);
  const [mealType, setMealType] = useState(initialMeal.mealType);
  const [consumedTime, setConsumedTime] = useState(initialMeal.consumedTime);
  const [notes, setNotes] = useState(initialMeal.notes ?? '');
  const [items, setItems] = useState<EditableMealItemState[]>(() => createEditableItems(initialMeal));
  const [fieldErrors, setFieldErrors] = useState<MealSaveFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLabel, setActionLabel] = useState<'save' | 'delete' | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialSnapshot = useMemo(
    () =>
      createSnapshot({
        dayKey: initialMeal.dayKey,
        title: initialMeal.title,
        mealType: initialMeal.mealType,
        consumedTime: initialMeal.consumedTime,
        notes: initialMeal.notes ?? '',
        items: createEditableItems(initialMeal),
      }),
    [initialMeal],
  );

  const snapshot = createSnapshot({
    dayKey,
    title,
    mealType,
    consumedTime,
    notes,
    items,
  });

  const isDirty = snapshot !== initialSnapshot;
  const totals = sumTotals(items);

  function updateItem(index: number, key: keyof EditableMealItemState, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: makeItemId(),
        displayName: '',
        quantityAmount: '',
        quantityUnit: '',
        gramsEstimate: '',
        calories: '0',
        proteinGrams: '0',
        carbGrams: '0',
        fatGrams: '0',
        fiberGrams: '0',
      },
    ]);
  }

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function buildPayload() {
    return {
      dayKey,
      title,
      mealType,
      consumedTime,
      notes,
      items: items.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        quantityAmount: item.quantityAmount.length > 0 ? item.quantityAmount : null,
        quantityUnit: item.quantityUnit,
        gramsEstimate: item.gramsEstimate.length > 0 ? item.gramsEstimate : null,
        macros: {
          calories: item.calories,
          proteinGrams: item.proteinGrams,
          carbGrams: item.carbGrams,
          fatGrams: item.fatGrams,
          fiberGrams: item.fiberGrams,
        },
      })),
    };
  }

  function handleSave() {
    if (isPending) {
      return;
    }

    setActionLabel('save');
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    if (!isDirty) {
      setFormSuccess('No changes to save. This final meal already matches what is on screen.');
      return;
    }

    const parsed = finalMealUpdateSchema.safeParse(buildPayload());

    if (!parsed.success) {
      setFieldErrors(flattenFinalMealFieldErrors(parsed.error));
      setFormError('A few meal details need another look before this can be saved.');
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${initialMeal.mealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as MealSaveResult | null;

      if (!response.ok || !payload?.ok) {
        setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
        setFormError(payload?.ok === false ? payload.message : 'The meal could not be updated. Please try again.');
        return;
      }

      setFormSuccess('Meal saved. Daily totals will now reflect the updated meal items.');
      router.push(payload.redirectTo as Route);
      router.refresh();
    });
  }

  function handleDelete() {
    if (isPending) {
      return;
    }

    setActionLabel('delete');
    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/meals/${initialMeal.mealId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json().catch(() => null)) as MealDeleteResult | null;

      if (!response.ok || !payload?.ok) {
        setFormError(payload?.ok === false ? payload.message : 'The meal could not be deleted. Please try again.');
        return;
      }

      router.push((dayKey === getAppDayKey(new Date()) ? '/app' : `/app?day=${dayKey}`) as Route);
      router.refresh();
    });
  }

  return (
    <div className="pb-40">
      <div className="space-y-6">
        <Card tone="hero" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Saved meal editor</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Update the final meal record</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Edit the saved meal.</p>
            </div>
            <StatusPill tone={isDirty ? 'neutral' : 'success'}>{isDirty ? 'Unsaved edits' : 'Saved'}</StatusPill>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatWidget label="Calories" value={`${Math.round(totals.calories)}`} helper="Live total" tone="accent" />
            <StatWidget
              label="Macros"
              value={`${Math.round(totals.proteinGrams)}p`}
              helper={`${Math.round(totals.carbGrams)}c · ${Math.round(totals.fatGrams)}f`}
            />
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="meal-title" className="text-sm font-semibold text-slate-900">
                Meal title
              </label>
              <Input
                id="meal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2"
                placeholder="Lunch with steak"
                maxLength={120}
              />
              {getFieldError('title') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('title')}</p> : null}
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
              {getFieldError('mealType') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('mealType')}</p> : null}
            </div>

            <div>
              <label htmlFor="meal-time" className="text-sm font-semibold text-slate-900">
                Time on this day
              </label>
              <Input id="meal-time" type="time" value={consumedTime} onChange={(event) => setConsumedTime(event.target.value)} className="mt-2" />
              {getFieldError('consumedTime') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('consumedTime')}</p> : null}
            </div>

            <div>
              <label htmlFor="meal-notes" className="text-sm font-semibold text-slate-900">
                Notes
              </label>
              <Textarea
                id="meal-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2"
                placeholder="Optional notes for this saved meal."
                maxLength={600}
              />
              {getFieldError('notes') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('notes')}</p> : null}
            </div>
          </div>
        </Card>

        {formError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
        ) : null}

        {formSuccess ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{formSuccess}</div>
        ) : null}

        {items.length === 0 ? (
          <StatePanel
            variant="empty"
            title="This saved meal has no item rows right now"
            description="Add at least one item."
            action={
              <Button type="button" variant="secondary" onClick={addItem}>
                <Icon name="plus" className="h-4 w-4" />
                Add first item
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
            <Card key={item.id} tone="subtle" className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Saved item {index + 1}</p>
                  <p className="mt-2 text-sm text-slate-500">Counts after save.</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length <= 1 || isPending}
                  className={buttonStyles({
                    variant: 'ghost',
                    size: 'sm',
                    className: 'text-rose-600 disabled:text-slate-300',
                  })}
                >
                  Remove
                </button>
              </div>

              <div>
                <label htmlFor={`saved-item-name-${item.id}`} className="text-sm font-semibold text-slate-900">
                  Item name
                </label>
                <Input
                  id={`saved-item-name-${item.id}`}
                  value={item.displayName}
                  onChange={(event) => updateItem(index, 'displayName', event.target.value)}
                  className="mt-2"
                  placeholder="Beef steak"
                />
                {getFieldError(`items.${index}.displayName`) ? (
                  <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.displayName`)}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`saved-item-amount-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Portion amount
                  </label>
                  <Input
                    id={`saved-item-amount-${item.id}`}
                    inputMode="decimal"
                    value={item.quantityAmount}
                    onChange={(event) => updateItem(index, 'quantityAmount', event.target.value)}
                    className="mt-2"
                    placeholder="1"
                  />
                  {getFieldError(`items.${index}.quantityAmount`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.quantityAmount`)}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`saved-item-unit-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Portion unit
                  </label>
                  <Input
                    id={`saved-item-unit-${item.id}`}
                    value={item.quantityUnit}
                    onChange={(event) => updateItem(index, 'quantityUnit', event.target.value)}
                    className="mt-2"
                    placeholder="porsiyon"
                  />
                  {getFieldError(`items.${index}.quantityUnit`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.quantityUnit`)}</p>
                  ) : null}
                </div>

                <div className="col-span-2">
                  <label htmlFor={`saved-item-grams-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Grams
                  </label>
                  <Input
                    id={`saved-item-grams-${item.id}`}
                    inputMode="decimal"
                    value={item.gramsEstimate}
                    onChange={(event) => updateItem(index, 'gramsEstimate', event.target.value)}
                    className="mt-2"
                    placeholder="180"
                  />
                  {getFieldError(`items.${index}.gramsEstimate`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.gramsEstimate`)}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'calories' as const, label: 'Calories' },
                  { key: 'proteinGrams' as const, label: 'Protein (g)' },
                  { key: 'carbGrams' as const, label: 'Carbs (g)' },
                  { key: 'fatGrams' as const, label: 'Fat (g)' },
                ].map((field) => (
                  <div key={field.key}>
                    <label htmlFor={`${field.key}-${item.id}`} className="text-sm font-semibold text-slate-900">
                      {field.label}
                    </label>
                    <Input
                      id={`${field.key}-${item.id}`}
                      inputMode="decimal"
                      value={item[field.key]}
                      onChange={(event) => updateItem(index, field.key, event.target.value)}
                      className="mt-2"
                    />
                    {getFieldError(`items.${index}.macros.${field.key}`) ? (
                      <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.${field.key}`)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addItem}
          disabled={isPending}
          className={buttonStyles({ variant: 'soft', fullWidth: true, className: 'h-14 rounded-[24px]' })}
        >
          <Icon name="plus" className="h-4 w-4" />
          Add item
        </button>

        <Card tone="subtle" className="border-rose-200 bg-rose-50/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-900">Delete this meal</p>
              <p className="mt-2 text-sm leading-6 text-rose-700">
                Deletes this meal.
              </p>
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
              <p className="mt-2 text-sm leading-6 text-slate-600">This cannot be undone.</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full border-rose-200 text-rose-700 hover:bg-rose-100"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending && actionLabel === 'delete' ? 'Deleting...' : 'Delete meal permanently'}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <BottomActionBar>
          <Button type="button" onClick={handleSave} disabled={isPending || items.length === 0}>
            {isPending && actionLabel === 'save' ? 'Saving changes...' : isDirty ? 'Save meal changes' : 'No changes to save'}
          </Button>
          <p className="text-center text-xs leading-5 text-slate-500">
            Saves changes.
          </p>
        </BottomActionBar>
      </div>
    </div>
  );
}
