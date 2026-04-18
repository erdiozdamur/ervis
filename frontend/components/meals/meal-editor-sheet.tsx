'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/components/ui/icon';
import { mealTypeOptions } from '@/lib/meals/constants';
import { finalMealUpdateSchema, flattenFinalMealFieldErrors } from '@/lib/meals/final-meal-validation';
import { cn } from '@/lib/utils/cn';
import type { MealEditorSnapshot, MealSaveFieldErrors, MealSaveResult } from '@/types/meals';

type MealEditorSheetProps = {
  mealId: string;
  isDraft: boolean;
};

type EditableItem = {
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

type SnapshotResponse =
  | {
      ok: true;
      meal: MealEditorSnapshot;
    }
  | {
      ok: false;
      message: string;
    };

function toEditableItems(meal: MealEditorSnapshot): EditableItem[] {
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

function makeItemId() {
  return `inline-meal-item-${Math.random().toString(36).slice(2, 10)}`;
}

export function MealEditorSheet({ mealId, isDraft }: MealEditorSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MealEditorSnapshot | null>(null);
  const [mealTitle, setMealTitle] = useState('');
  const [mealType, setMealType] = useState<MealEditorSnapshot['mealType']>('OTHER');
  const [consumedTime, setConsumedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<MealSaveFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm(nextSnapshot: MealEditorSnapshot) {
    setSnapshot(nextSnapshot);
    setMealTitle(nextSnapshot.title);
    setMealType(nextSnapshot.mealType);
    setConsumedTime(nextSnapshot.consumedTime);
    setNotes(nextSnapshot.notes ?? '');
    setItems(toEditableItems(nextSnapshot));
    setFieldErrors({});
    setFormError(null);
  }

  async function handleOpen() {
    setOpen(true);
    if (isDraft) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    setFormError(null);

    const response = await fetch(`/api/meals/${mealId}`, {
      method: 'GET',
    });

    const payload = (await response.json().catch(() => null)) as SnapshotResponse | null;
    setLoading(false);

    if (!response.ok || !payload?.ok) {
      setLoadError(payload?.ok === false ? payload.message : 'Öğün yüklenemedi.');
      return;
    }

    resetForm(payload.meal);
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

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateItem(index: number, key: keyof EditableItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function getFieldError(path: string) {
    return fieldErrors[path] ?? null;
  }

  function handleSave() {
    if (!snapshot || isPending) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const parsed = finalMealUpdateSchema.safeParse({
      dayKey: snapshot.dayKey,
      title: mealTitle,
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
    });

    if (!parsed.success) {
      setFieldErrors(flattenFinalMealFieldErrors(parsed.error));
      setFormError('Lütfen alanları kontrol et.');
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as MealSaveResult | null;

      if (!response.ok || !payload?.ok) {
        setFieldErrors(payload?.ok === false ? payload.fieldErrors ?? {} : {});
        setFormError(payload?.ok === false ? payload.message : 'Öğün kaydedilemedi.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setFormError('Öğün silinemedi.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  function handleConfirmDraft() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${mealId}/confirm`, {
        method: 'POST',
      });

      const payload = (await response.json().catch(() => null)) as { ok: boolean; message?: string } | null;

      if (!response.ok || !payload?.ok) {
        setFormError(payload?.message ?? 'Taslak onaylanamadı.');
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
        {isDraft ? 'Taslak' : 'Düzenle'}
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={isDraft ? 'Taslak öğün' : 'Öğünü düzenle'}
        description={isDraft ? 'Taslak öğünler bu panelde düzenlenemez.' : undefined}
        footer={
          !isDraft ? (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={handleDelete} disabled={isPending}>
                Sil
              </Button>
              <Button onClick={handleSave} disabled={isPending || !snapshot}>
                {isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={handleDelete} disabled={isPending}>
                Sil
              </Button>
              <Button onClick={handleConfirmDraft} disabled={isPending}>
                Onayla
              </Button>
            </div>
          )
        }
      >
        {isDraft ? (
          <Card tone="subtle" className="text-sm text-slate-700">
            Bu öğün taslak durumda. Onayla dediğinde güne eklenir.
          </Card>
        ) : null}

        {loading ? <Card tone="subtle">Yükleniyor...</Card> : null}
        {loadError ? <Card tone="subtle" className="text-rose-700">{loadError}</Card> : null}

        {!loading && !loadError && snapshot && !isDraft ? (
          <div className="space-y-4">
            {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div> : null}

            <Card tone="subtle" className="space-y-4">
              <div>
                <label htmlFor={`meal-title-${mealId}`} className="text-sm font-semibold text-slate-900">
                  Öğün adı
                </label>
                <Input
                  id={`meal-title-${mealId}`}
                  value={mealTitle}
                  onChange={(event) => setMealTitle(event.target.value)}
                  className="mt-2"
                />
                {getFieldError('title') ? <p className="mt-2 text-sm text-rose-600">{getFieldError('title')}</p> : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Öğün tipi</p>
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
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor={`meal-time-${mealId}`} className="text-sm font-semibold text-slate-900">
                  Saat
                </label>
                <Input
                  id={`meal-time-${mealId}`}
                  type="time"
                  value={consumedTime}
                  onChange={(event) => setConsumedTime(event.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <label htmlFor={`meal-note-${mealId}`} className="text-sm font-semibold text-slate-900">
                  Not
                </label>
                <Textarea
                  id={`meal-note-${mealId}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-2"
                  placeholder="Opsiyonel not"
                />
              </div>
            </Card>

            {items.map((item, index) => (
              <Card key={item.id} tone="subtle" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Besin {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                    className={buttonStyles({ variant: 'ghost', size: 'sm' })}
                  >
                    Sil
                  </button>
                </div>

                <Input value={item.displayName} onChange={(event) => updateItem(index, 'displayName', event.target.value)} placeholder="Besin adı" />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={item.quantityAmount}
                    onChange={(event) => updateItem(index, 'quantityAmount', event.target.value)}
                    placeholder="Miktar"
                    inputMode="decimal"
                  />
                  <Input value={item.quantityUnit} onChange={(event) => updateItem(index, 'quantityUnit', event.target.value)} placeholder="Birim" />
                  <Input
                    value={item.gramsEstimate}
                    onChange={(event) => updateItem(index, 'gramsEstimate', event.target.value)}
                    placeholder="Gram"
                    inputMode="decimal"
                  />
                  <Input
                    value={item.calories}
                    onChange={(event) => updateItem(index, 'calories', event.target.value)}
                    placeholder="Kalori"
                    inputMode="decimal"
                  />
                  <Input
                    value={item.proteinGrams}
                    onChange={(event) => updateItem(index, 'proteinGrams', event.target.value)}
                    placeholder="Protein"
                    inputMode="decimal"
                  />
                  <Input
                    value={item.carbGrams}
                    onChange={(event) => updateItem(index, 'carbGrams', event.target.value)}
                    placeholder="Karbonhidrat"
                    inputMode="decimal"
                  />
                  <Input
                    value={item.fatGrams}
                    onChange={(event) => updateItem(index, 'fatGrams', event.target.value)}
                    placeholder="Yağ"
                    inputMode="decimal"
                  />
                  <Input
                    value={item.fiberGrams}
                    onChange={(event) => updateItem(index, 'fiberGrams', event.target.value)}
                    placeholder="Lif"
                    inputMode="decimal"
                  />
                </div>
              </Card>
            ))}

            <button type="button" onClick={addItem} className={buttonStyles({ variant: 'soft', fullWidth: true })}>
              <Icon name="plus" className="h-4 w-4" />
              Besin ekle
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
