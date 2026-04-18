'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { BottomActionBar } from '@/components/layout/bottom-action-bar';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { StatWidget } from '@/components/ui/stat-widget';
import { StatusPill } from '@/components/ui/status-pill';
import {
  flattenMealDraftResultFieldErrors,
  mealDraftResultUpdateSchema,
} from '@/lib/meals/draft-result-validation';
import { mealTypeOptions } from '@/lib/meals/constants';
import { cn } from '@/lib/utils/cn';
import type {
  MealDraftAnalysisResult,
  MealDraftConfirmResult,
  MealDraftResultFieldErrors,
  MealDraftResultUpdateResult,
} from '@/types/meal-analysis';

type EditableDraftItemState = {
  id: string;
  displayName: string;
  quantityText: string;
  gramsEstimate: string;
  calories: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  fiberGrams: string;
  sourceLabel: string;
  unresolved: boolean;
  confidence: number;
};

type MealDraftReviewExperienceProps = {
  mealId: string;
  dayKey: string;
  initialDraftResult: MealDraftAnalysisResult;
};

function createEditableItems(draftResult: MealDraftAnalysisResult): EditableDraftItemState[] {
  return draftResult.items.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    quantityText: item.quantityText ?? '',
    gramsEstimate: item.gramsEstimate != null ? String(item.gramsEstimate) : '',
    calories: String(item.macros.calories),
    proteinGrams: String(item.macros.proteinGrams),
    carbGrams: String(item.macros.carbGrams),
    fatGrams: String(item.macros.fatGrams),
    fiberGrams: String(item.macros.fiberGrams),
    sourceLabel:
      item.nutritionSource === 'USER_REVIEW'
        ? 'Edited by you'
        : item.nutritionSource === 'CACHE'
          ? 'Shared cache'
          : item.nutritionSource === 'CATALOG'
            ? 'Shared catalog'
            : 'Fresh analysis',
    unresolved: item.unresolved,
    confidence: item.confidence,
  }));
}

function createSnapshot({
  titleSuggestion,
  mealTypeSuggestion,
  items,
}: {
  titleSuggestion: string;
  mealTypeSuggestion: MealDraftAnalysisResult['mealTypeSuggestion'];
  items: EditableDraftItemState[];
}) {
  return JSON.stringify({
    titleSuggestion,
    mealTypeSuggestion,
    items,
  });
}

function makeDraftItemId() {
  return `user-item-${Math.random().toString(36).slice(2, 10)}`;
}

function sumTotals(items: EditableDraftItemState[]) {
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

export function MealDraftReviewExperience({
  mealId,
  dayKey,
  initialDraftResult,
}: MealDraftReviewExperienceProps) {
  const router = useRouter();
  const [titleSuggestion, setTitleSuggestion] = useState(initialDraftResult.titleSuggestion);
  const [mealTypeSuggestion, setMealTypeSuggestion] = useState(initialDraftResult.mealTypeSuggestion);
  const [items, setItems] = useState<EditableDraftItemState[]>(() => createEditableItems(initialDraftResult));
  const [fieldErrors, setFieldErrors] = useState<MealDraftResultFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState<'save' | 'confirm' | null>(null);
  const [isPending, startTransition] = useTransition();

  const snapshot = createSnapshot({ titleSuggestion, mealTypeSuggestion, items });
  const initialSnapshot = useMemo(
    () =>
      createSnapshot({
        titleSuggestion: initialDraftResult.titleSuggestion,
        mealTypeSuggestion: initialDraftResult.mealTypeSuggestion,
        items: createEditableItems(initialDraftResult),
      }),
    [initialDraftResult],
  );
  const isDirty = snapshot !== initialSnapshot;
  const totals = sumTotals(items);

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function updateItem(index: number, key: keyof EditableDraftItemState, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: makeDraftItemId(),
        displayName: '',
        quantityText: '',
        gramsEstimate: '',
        calories: '0',
        proteinGrams: '0',
        carbGrams: '0',
        fatGrams: '0',
        fiberGrams: '0',
        sourceLabel: 'Added by you',
        unresolved: false,
        confidence: 1,
      },
    ]);
  }

  function buildPayload() {
    return {
      titleSuggestion,
      mealTypeSuggestion,
      items: items.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        quantityText: item.quantityText,
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

  async function persistDraftEdits() {
    const parsed = mealDraftResultUpdateSchema.safeParse(buildPayload());

    if (!parsed.success) {
      setFieldErrors(flattenMealDraftResultFieldErrors(parsed.error));
      setFormError('A few draft details need another look before this can be saved.');
      return { ok: false as const };
    }

    const response = await fetch(`/api/meals/${mealId}/draft-result`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
    });

    const payload = (await response.json().catch(() => null)) as MealDraftResultUpdateResult | null;

    if (!response.ok || !payload?.ok) {
      setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
      setFormError(payload?.ok === false ? payload.message : 'The draft result could not be updated. Please try again.');
      return { ok: false as const };
    }

    return { ok: true as const };
  }

  function handleSaveDraft() {
    if (isPending) {
      return;
    }

    setActionLabel('save');
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      const saveResult = await persistDraftEdits();

      if (!saveResult.ok) {
        return;
      }

      setFormSuccess('Draft changes saved. The meal is still not part of your day until you confirm it.');
      router.refresh();
    });
  }

  function handleConfirm() {
    if (isPending) {
      return;
    }

    setActionLabel('confirm');
    setFieldErrors({});
    setFormError(null);
    setFormSuccess(null);

    startTransition(async () => {
      const saveResult = await persistDraftEdits();

      if (!saveResult.ok) {
        return;
      }

      const response = await fetch(`/api/meals/${mealId}/confirm`, {
        method: 'POST',
      });

      const payload = (await response.json().catch(() => null)) as MealDraftConfirmResult | null;

      if (!response.ok || !payload?.ok) {
        setFormError(payload?.ok === false ? payload.message : 'The meal could not be confirmed. Please try again.');
        return;
      }

      router.push(payload.redirectTo as Route);
      router.refresh();
    });
  }

  return (
    <div className="pb-40">
      <div className="space-y-6">
        {initialDraftResult.warnings.length > 0 || items.some((item) => item.unresolved || item.confidence < 0.75) ? (
          <Card tone="subtle" className="border-amber-200 bg-amber-50/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Review focus</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Some parts of this draft need a closer look</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">Check uncertain items before confirm.</p>
              </div>
              <StatusPill tone="neutral">
                {items.filter((item) => item.unresolved || item.confidence < 0.75).length || initialDraftResult.warnings.length} checks
              </StatusPill>
            </div>

            {initialDraftResult.warnings.length > 0 ? (
              <div className="mt-4 space-y-2">
                {initialDraftResult.warnings.map((warning) => (
                  <div key={warning} className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700">
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card tone="hero" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Review before save</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Make sure this meal feels right</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Nothing is saved into {dayKey} yet.</p>
            </div>
            <StatusPill tone={isDirty ? 'neutral' : 'success'}>{isDirty ? 'Unsaved edits' : 'Ready'}</StatusPill>
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
              <label htmlFor="draft-title" className="text-sm font-semibold text-slate-900">
                Meal title
              </label>
              <Input
                id="draft-title"
                value={titleSuggestion}
                onChange={(event) => setTitleSuggestion(event.target.value)}
                className="mt-2"
                placeholder="Dinner with rice and salad"
                maxLength={120}
              />
              {getFieldError('titleSuggestion') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('titleSuggestion')}</p> : null}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Meal type</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {mealTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMealTypeSuggestion(option.value)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition',
                      mealTypeSuggestion === option.value
                        ? 'border-slate-950 bg-slate-950 text-white shadow-soft'
                        : 'border-slate-200 bg-white text-slate-800 shadow-soft',
                    )}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className={cn('mt-1 text-xs leading-5', mealTypeSuggestion === option.value ? 'text-white/75' : 'text-slate-500')}>
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
              {getFieldError('mealTypeSuggestion') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('mealTypeSuggestion')}</p> : null}
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
            title="No food items are in this draft yet"
            description="Add items manually."
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
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Food item {index + 1}</p>
                  <p className="mt-2 text-sm text-slate-500">{item.sourceLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={item.unresolved || item.confidence < 0.75 ? 'neutral' : 'success'}>
                    {item.unresolved || item.confidence < 0.75 ? 'Needs review' : 'More certain'}
                  </StatusPill>
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
              </div>

              {item.unresolved || item.confidence < 0.75 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-slate-700">
                  Low confidence. Check it.
                </div>
              ) : null}

              <div>
                <label htmlFor={`item-name-${item.id}`} className="text-sm font-semibold text-slate-900">
                  Item name
                </label>
                <Input
                  id={`item-name-${item.id}`}
                  value={item.displayName}
                  onChange={(event) => updateItem(index, 'displayName', event.target.value)}
                  className="mt-2"
                  placeholder="Grilled beef steak"
                  maxLength={160}
                />
                {getFieldError(`items.${index}.displayName`) ? (
                  <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.displayName`)}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`item-portion-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Portion note
                  </label>
                  <Input
                    id={`item-portion-${item.id}`}
                    value={item.quantityText}
                    onChange={(event) => updateItem(index, 'quantityText', event.target.value)}
                    className="mt-2"
                    placeholder="1 tabak"
                    maxLength={60}
                  />
                  {getFieldError(`items.${index}.quantityText`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.quantityText`)}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`item-grams-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Grams
                  </label>
                  <Input
                    id={`item-grams-${item.id}`}
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
          Add missing item
        </button>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <BottomActionBar>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={handleSaveDraft} disabled={isPending || !isDirty}>
              {isPending && actionLabel === 'save' ? 'Saving draft...' : isDirty ? 'Save draft edits' : 'Draft already saved'}
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={isPending || items.length === 0}>
              {isPending && actionLabel === 'confirm' ? 'Confirming...' : 'Confirm meal'}
            </Button>
          </div>
          <p className="text-center text-xs leading-5 text-slate-500">
            Confirm saves this meal.
          </p>
        </BottomActionBar>
      </div>
    </div>
  );
}
