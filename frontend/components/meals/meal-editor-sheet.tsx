'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { UIEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { finalMealUpdateSchema, flattenFinalMealFieldErrors } from '@/lib/meals/final-meal-validation';
import type { MealEditorSnapshot, MealSaveFieldErrors, MealSaveResult } from '@/types/meals';
import { cn } from '@/lib/utils/cn';

type MealEditorSheetProps = {
  mealId: string;
  isDraft: boolean;
  children?: ReactNode;
  triggerClassName?: string;
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

type BaseItemSnapshot = {
  quantityAmount: number | null;
  gramsEstimate: number | null;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  fiberGrams: number;
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

function toBaseItems(meal: MealEditorSnapshot): Record<string, BaseItemSnapshot> {
  return Object.fromEntries(
    meal.items.map((item) => [
      item.id,
      {
        quantityAmount: item.quantityAmount,
        gramsEstimate: item.gramsEstimate,
        calories: item.calories,
        proteinGrams: item.proteinGrams,
        carbGrams: item.carbGrams,
        fatGrams: item.fatGrams,
        fiberGrams: item.fiberGrams,
      },
    ]),
  );
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function parsePositive(value: string) {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseNonNegative(value: string) {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function getRequiredFieldErrors(items: EditableItem[]) {
  const errors: MealSaveFieldErrors = {};

  if (items.length === 0) {
    errors.items = 'En az bir besin olmalı.';
    return errors;
  }

  items.forEach((item, index) => {
    if (item.displayName.trim().length === 0) {
      errors[`items.${index}.displayName`] = 'Besin adı zorunlu.';
    }

    if (!parsePositive(item.quantityAmount)) {
      errors[`items.${index}.quantityAmount`] = 'Miktar 0\'dan büyük olmalı.';
    }

    if (item.quantityUnit.trim().length === 0) {
      errors[`items.${index}.quantityUnit`] = 'Birim zorunlu.';
    }

    if (parseNonNegative(item.calories) == null) {
      errors[`items.${index}.calories`] = 'Kalori zorunlu.';
    }

    if (parseNonNegative(item.proteinGrams) == null) {
      errors[`items.${index}.proteinGrams`] = 'Protein zorunlu.';
    }

    if (parseNonNegative(item.carbGrams) == null) {
      errors[`items.${index}.carbGrams`] = 'Karbonhidrat zorunlu.';
    }

    if (parseNonNegative(item.fatGrams) == null) {
      errors[`items.${index}.fatGrams`] = 'Yağ zorunlu.';
    }

    if (parseNonNegative(item.fiberGrams) == null) {
      errors[`items.${index}.fiberGrams`] = 'Lif zorunlu.';
    }
  });

  return errors;
}

export function MealEditorSheet({ mealId, isDraft, children, triggerClassName }: MealEditorSheetProps) {
  const router = useRouter();
  const [isPortalReady, setIsPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MealEditorSnapshot | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [baseItemsById, setBaseItemsById] = useState<Record<string, BaseItemSnapshot>>({});
  const [fieldErrors, setFieldErrors] = useState<MealSaveFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const itemCount = items.length;
  const totalCalories = useMemo(
    () => Math.round(items.reduce((sum, item) => sum + (parseNonNegative(item.calories) ?? 0), 0)),
    [items],
  );

  function resetForm(nextSnapshot: MealEditorSnapshot) {
    setSnapshot(nextSnapshot);
    setItems(toEditableItems(nextSnapshot));
    setBaseItemsById(toBaseItems(nextSnapshot));
    setFieldErrors({});
    setFormError(null);
    setShowDeleteConfirm(false);
    setActiveIndex(0);
  }

  async function handleOpen() {
    setOpen(true);
    if (isDraft) {
      setLoadError('Taslak öğünler bu panelde düzenlenemez.');
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

  function closePanel() {
    setOpen(false);
    setShowDeleteConfirm(false);
  }

  function removeItem(index: number) {
    setItems((current) => {
      const nextItems = current.filter((_, itemIndex) => itemIndex !== index);
      setActiveIndex((currentIndex) => Math.min(currentIndex, Math.max(0, nextItems.length - 1)));
      return nextItems;
    });
    setFieldErrors({});
    setFormError(null);
  }

  function updateItem(index: number, key: keyof EditableItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function updateQuantity(index: number, value: string) {
    setItems((current) => {
      const next = [...current];
      const target = next[index];
      if (!target) {
        return current;
      }

      target.quantityAmount = value;
      const baseline = baseItemsById[target.id];
      const nextQuantity = parsePositive(value);

      if (!baseline || baseline.quantityAmount == null || baseline.quantityAmount <= 0 || !nextQuantity) {
        return next;
      }

      const ratio = nextQuantity / baseline.quantityAmount;
      target.calories = String(roundOne(baseline.calories * ratio));
      target.proteinGrams = String(roundOne(baseline.proteinGrams * ratio));
      target.carbGrams = String(roundOne(baseline.carbGrams * ratio));
      target.fatGrams = String(roundOne(baseline.fatGrams * ratio));
      target.fiberGrams = String(roundOne(baseline.fiberGrams * ratio));

      if (baseline.gramsEstimate != null && baseline.gramsEstimate > 0) {
        target.gramsEstimate = String(roundOne(baseline.gramsEstimate * ratio));
      }

      return next;
    });
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

    const requiredErrors = getRequiredFieldErrors(items);
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      setFormError('Eksik alanları tamamla ve tekrar kaydet.');
      return;
    }

    const parsed = finalMealUpdateSchema.safeParse({
      dayKey: snapshot.dayKey,
      title: snapshot.title,
      mealType: snapshot.mealType,
      consumedTime: snapshot.consumedTime,
      notes: snapshot.notes,
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

      closePanel();
      router.refresh();
    });
  }

  function requestDelete() {
    setShowDeleteConfirm(true);
  }

  function cancelDelete() {
    setShowDeleteConfirm(false);
  }

  function confirmDelete() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setFormError('Öğün silinemedi.');
        setShowDeleteConfirm(false);
        return;
      }

      setShowDeleteConfirm(false);
      closePanel();
      router.refresh();
    });
  }

  function onItemTrackScroll(event: UIEvent<HTMLDivElement>) {
    const container = event.currentTarget;
    if (container.clientWidth === 0) {
      return;
    }

    const next = Math.round(container.scrollLeft / container.clientWidth);
    if (next !== activeIndex) {
      setActiveIndex(Math.max(0, Math.min(items.length - 1, next)));
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={cn(children ? 'w-full text-left' : buttonStyles({ variant: 'ghost', size: 'sm' }), triggerClassName)}>
        {children ?? (isDraft ? 'Taslak' : 'Düzenle')}
      </button>

      {open && isPortalReady
        ? createPortal(
            <div className="fixed inset-0 z-[70] overflow-hidden bg-white">
          <div className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-[30rem] flex-col bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-5 sm:pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Öğün detayı</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{snapshot?.title ?? 'Öğün'}</h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-soft"
                aria-label="Paneli kapat"
              >
                <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
              </button>
            </div>

            {loading ? <Card tone="subtle" className="mt-4">Yükleniyor...</Card> : null}
            {loadError ? <Card tone="subtle" className="mt-4 text-rose-700">{loadError}</Card> : null}

            {!loading && !loadError && snapshot ? (
              <>
                <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-slate-100 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">Toplam</p>
                  <p className="font-semibold text-slate-900">{totalCalories} kcal</p>
                </div>

                {formError ? (
                  <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{formError}</div>
                ) : null}

                <div className="mt-2.5 min-h-0 flex-1 overflow-hidden">
                  {items.length === 0 ? (
                    <Card tone="subtle" className="h-full text-center">
                      <p className="text-base font-semibold text-slate-900">Bu öğünde besin bulunamadı</p>
                      <p className="mt-2 text-sm text-slate-600">Yeni bir öğün ekleyebilir veya bu kaydı silebilirsin.</p>
                    </Card>
                  ) : (
                    <div className="h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-1" onScroll={onItemTrackScroll}>
                      <div className="flex h-full min-h-0 gap-2.5">
                        {items.map((item, index) => (
                          <div key={item.id} className="h-full min-h-0 w-full shrink-0 snap-center overflow-x-hidden">
                            <Card tone="subtle" className="flex h-full min-h-0 flex-col overflow-x-hidden p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">Besin {index + 1}</p>
                                <button type="button" onClick={() => removeItem(index)} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
                                  Sil
                                </button>
                              </div>

                              <div className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Besin adı</label>
                                  <Input
                                    value={item.displayName}
                                    onChange={(event) => updateItem(index, 'displayName', event.target.value)}
                                    placeholder="Besin adı"
                                    className="mt-1.5 h-10"
                                  />
                                  {getFieldError(`items.${index}.displayName`) ? (
                                    <p className="mt-1 text-sm text-rose-600">{getFieldError(`items.${index}.displayName`)}</p>
                                  ) : null}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="min-w-0">
                                    <label className="block truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Miktar</label>
                                    <Input
                                      value={item.quantityAmount}
                                      onChange={(event) => updateQuantity(index, event.target.value)}
                                      placeholder="Miktar"
                                      inputMode="decimal"
                                      className="mt-1.5 h-10"
                                    />
                                    {getFieldError(`items.${index}.quantityAmount`) ? (
                                      <p className="mt-1 text-sm text-rose-600">{getFieldError(`items.${index}.quantityAmount`)}</p>
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <label className="block truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Birim</label>
                                    <Input
                                      value={item.quantityUnit}
                                      onChange={(event) => updateItem(index, 'quantityUnit', event.target.value)}
                                      placeholder="Birim"
                                      className="mt-1.5 h-10"
                                    />
                                    {getFieldError(`items.${index}.quantityUnit`) ? (
                                      <p className="mt-1 text-sm text-rose-600">{getFieldError(`items.${index}.quantityUnit`)}</p>
                                    ) : null}
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gram</label>
                                  <Input
                                    value={item.gramsEstimate}
                                    onChange={(event) => updateItem(index, 'gramsEstimate', event.target.value)}
                                    placeholder="Gram"
                                    inputMode="decimal"
                                    className="mt-1.5 h-10"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {[
                                    { key: 'calories', label: 'Kalori' },
                                    { key: 'proteinGrams', label: 'Protein' },
                                    { key: 'carbGrams', label: 'Karbonhidrat' },
                                    { key: 'fatGrams', label: 'Yağ' },
                                    { key: 'fiberGrams', label: 'Lif' },
                                  ].map((field) => {
                                    const key = field.key as keyof EditableItem;
                                    return (
                                      <div key={field.key} className="min-w-0">
                                        <label className="block truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{field.label}</label>
                                        <Input
                                          value={item[key]}
                                          onChange={(event) => updateItem(index, key, event.target.value)}
                                          placeholder={field.label}
                                          inputMode="decimal"
                                          className="mt-1.5 h-10"
                                        />
                                        {getFieldError(`items.${index}.${field.key}`) ? (
                                          <p className="mt-1 text-sm text-rose-600">{getFieldError(`items.${index}.${field.key}`)}</p>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </Card>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {itemCount > 1 ? (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5">
                    {items.map((item, index) => (
                      <span
                        key={item.id}
                        className={cn('h-1.5 w-1.5 rounded-full transition-all', index === activeIndex ? 'w-4 bg-slate-900' : 'bg-slate-300')}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-slate-200 bg-white pt-2.5">
                  <Button variant="secondary" onClick={requestDelete} disabled={isPending}>
                    Sil
                  </Button>
                  <Button onClick={handleSave} disabled={isPending || !snapshot}>
                    {isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          {showDeleteConfirm ? (
            <div className="absolute inset-0 z-10 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true">
              <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-floating">
                <h3 className="text-base font-semibold text-slate-950">Öğünü silmek istediğine emin misin?</h3>
                <p className="mt-2 text-sm text-slate-600">Bu işlem geri alınamaz.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={cancelDelete} disabled={isPending}>
                    Vazgeç
                  </Button>
                  <Button onClick={confirmDelete} disabled={isPending}>
                    {isPending ? 'Siliniyor...' : 'Sil'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
