'use client';

import type { FormEvent } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { mealTypeOptions } from '@/lib/meals/constants';
import {
  flattenMealDraftResultFieldErrors,
  mealDraftResultUpdateSchema,
} from '@/lib/meals/draft-result-validation';
import { cn } from '@/lib/utils/cn';
import type {
  MealDraftAnalysisResult,
  MealDraftResultFieldErrors,
  MealDraftResultUpdateResult,
} from '@/types/meal-analysis';

type DraftResultEditorSheetProps = {
  mealId: string;
  draftResult: MealDraftAnalysisResult;
};

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
  }));
}

export function DraftResultEditorSheet({ mealId, draftResult }: DraftResultEditorSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titleSuggestion, setTitleSuggestion] = useState(draftResult.titleSuggestion);
  const [mealTypeSuggestion, setMealTypeSuggestion] = useState(draftResult.mealTypeSuggestion);
  const [items, setItems] = useState<EditableDraftItemState[]>(() => createEditableItems(draftResult));
  const [fieldErrors, setFieldErrors] = useState<MealDraftResultFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setTitleSuggestion(draftResult.titleSuggestion);
    setMealTypeSuggestion(draftResult.mealTypeSuggestion);
    setItems(createEditableItems(draftResult));
    setFieldErrors({});
    setFormError(null);
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

  function updateItem(index: number, key: keyof EditableDraftItemState, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = mealDraftResultUpdateSchema.safeParse({
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
    });

    if (!parsed.success) {
      setFieldErrors(flattenMealDraftResultFieldErrors(parsed.error));
      setFormError('A few draft details need another look before this can be saved.');
      return;
    }

    startTransition(async () => {
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
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
        Edit draft result
      </button>

      <BottomSheet
        open={open}
        onClose={handleClose}
        title="Edit draft before save"
        description="You can clean up the meal title, type, item names, and nutrition values here. The result stays in draft review until the final save flow is built."
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={handleClose} disabled={isPending}>
              Close
            </Button>
            <Button type="submit" form={`draft-result-${mealId}`} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save draft edits'}
            </Button>
          </div>
        }
      >
        <form id={`draft-result-${mealId}`} className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
          ) : null}

          <Card tone="subtle" className="space-y-4 p-4">
            <div>
              <label htmlFor={`draft-title-${mealId}`} className="text-sm font-semibold text-slate-900">
                Meal title
              </label>
              <Input
                id={`draft-title-${mealId}`}
                value={titleSuggestion}
                onChange={(event) => setTitleSuggestion(event.target.value)}
                className="mt-2"
                placeholder="Chicken wrap lunch"
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
                    <p
                      className={cn(
                        'mt-1 text-xs leading-5',
                        mealTypeSuggestion === option.value ? 'text-white/75' : 'text-slate-500',
                      )}
                    >
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
              {getFieldError('mealTypeSuggestion') ? (
                <p className="mt-2 text-sm text-rose-600">{getFieldError('mealTypeSuggestion')}</p>
              ) : null}
            </div>
          </Card>

          <div className="space-y-3">
            {items.map((item, index) => (
              <Card key={item.id} tone="subtle" className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Draft item {index + 1}</p>
                  <label htmlFor={`draft-item-name-${item.id}`} className="mt-2 block text-sm font-semibold text-slate-900">
                    Item name
                  </label>
                  <Input
                    id={`draft-item-name-${item.id}`}
                    value={item.displayName}
                    onChange={(event) => updateItem(index, 'displayName', event.target.value)}
                    className="mt-2"
                    placeholder="Grilled chicken wrap"
                    maxLength={160}
                  />
                  {getFieldError(`items.${index}.displayName`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.displayName`)}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`draft-item-quantity-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Quantity note
                  </label>
                  <Input
                    id={`draft-item-quantity-${item.id}`}
                    value={item.quantityText}
                    onChange={(event) => updateItem(index, 'quantityText', event.target.value)}
                    className="mt-2"
                    placeholder="1 wrap"
                    maxLength={60}
                  />
                  {getFieldError(`items.${index}.quantityText`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.quantityText`)}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={`draft-item-grams-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Grams
                  </label>
                  <Input
                    id={`draft-item-grams-${item.id}`}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`draft-item-calories-${item.id}`} className="text-sm font-semibold text-slate-900">
                      Calories
                    </label>
                    <Input
                      id={`draft-item-calories-${item.id}`}
                      inputMode="decimal"
                      value={item.calories}
                      onChange={(event) => updateItem(index, 'calories', event.target.value)}
                      className="mt-2"
                    />
                    {getFieldError(`items.${index}.macros.calories`) ? (
                      <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.calories`)}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`draft-item-protein-${item.id}`} className="text-sm font-semibold text-slate-900">
                      Protein (g)
                    </label>
                    <Input
                      id={`draft-item-protein-${item.id}`}
                      inputMode="decimal"
                      value={item.proteinGrams}
                      onChange={(event) => updateItem(index, 'proteinGrams', event.target.value)}
                      className="mt-2"
                    />
                    {getFieldError(`items.${index}.macros.proteinGrams`) ? (
                      <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.proteinGrams`)}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`draft-item-carbs-${item.id}`} className="text-sm font-semibold text-slate-900">
                      Carbs (g)
                    </label>
                    <Input
                      id={`draft-item-carbs-${item.id}`}
                      inputMode="decimal"
                      value={item.carbGrams}
                      onChange={(event) => updateItem(index, 'carbGrams', event.target.value)}
                      className="mt-2"
                    />
                    {getFieldError(`items.${index}.macros.carbGrams`) ? (
                      <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.carbGrams`)}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`draft-item-fat-${item.id}`} className="text-sm font-semibold text-slate-900">
                      Fat (g)
                    </label>
                    <Input
                      id={`draft-item-fat-${item.id}`}
                      inputMode="decimal"
                      value={item.fatGrams}
                      onChange={(event) => updateItem(index, 'fatGrams', event.target.value)}
                      className="mt-2"
                    />
                    {getFieldError(`items.${index}.macros.fatGrams`) ? (
                      <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.fatGrams`)}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label htmlFor={`draft-item-fiber-${item.id}`} className="text-sm font-semibold text-slate-900">
                    Fiber (g)
                  </label>
                  <Input
                    id={`draft-item-fiber-${item.id}`}
                    inputMode="decimal"
                    value={item.fiberGrams}
                    onChange={(event) => updateItem(index, 'fiberGrams', event.target.value)}
                    className="mt-2"
                  />
                  {getFieldError(`items.${index}.macros.fiberGrams`) ? (
                    <p className="mt-2 text-sm text-rose-600">{getFieldError(`items.${index}.macros.fiberGrams`)}</p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </form>
      </BottomSheet>
    </>
  );
}
