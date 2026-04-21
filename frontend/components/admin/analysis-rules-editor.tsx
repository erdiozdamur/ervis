'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { analysisRuleSetSchema, type AnalysisRuleSet } from '@/lib/analysis-rules/schema';

type Props = {
  initialRules: AnalysisRuleSet;
};

type CompositeRuleRow = AnalysisRuleSet['stage1']['compositeDishRules'][number];

function listToLines(values: string[]) {
  return values.join('\n');
}

function linesToList(value: string) {
  return value
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);
}

export function AnalysisRulesEditor({ initialRules }: Props) {
  const router = useRouter();
  const [platterKeywordsText, setPlatterKeywordsText] = useState(listToLines(initialRules.stage1.platterKeywords));
  const [genericImagePrefixesText, setGenericImagePrefixesText] = useState(listToLines(initialRules.stage1.genericImageNamePrefixes));
  const [rules, setRules] = useState<CompositeRuleRow[]>(initialRules.stage1.compositeDishRules);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canMove = useMemo(() => rules.length > 1, [rules.length]);

  function updateRule(index: number, patch: Partial<CompositeRuleRow>) {
    setRules((prev) => prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function moveRule(index: number, direction: -1 | 1) {
    setRules((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const current = next[index];
      const target = next[nextIndex];

      if (!current || !target) {
        return prev;
      }

      next[index] = { ...target, priority: index + 1 };
      next[nextIndex] = { ...current, priority: nextIndex + 1 };
      return next.map((rule, i) => ({ ...rule, priority: i + 1 }));
    });
  }

  function submit() {
    setError(null);
    setSuccess(null);

    const candidate: AnalysisRuleSet = {
      stage1: {
        platterKeywords: linesToList(platterKeywordsText),
        genericImageNamePrefixes: linesToList(genericImagePrefixesText),
        compositeDishRules: rules.map((rule, index) => ({
          ...rule,
          priority: index + 1,
          dishKeywords: rule.dishKeywords.map((keyword) => keyword.trim()).filter(Boolean),
          componentKeywords: rule.componentKeywords.map((keyword) => keyword.trim()).filter(Boolean),
        })),
      },
    };

    const parsed = analysisRuleSetSchema.safeParse(candidate);
    if (!parsed.success) {
      setError('Kural şeması doğrulanamadı. Boş alanları veya geçersiz değerleri düzeltin.');
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/admin/analysis-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string; ok?: boolean } | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? 'Kurallar kaydedilemedi.');
        return;
      }

      setSuccess('Analiz kuralları kaydedildi. Yeni analizlerde bu sürüm kullanılacak.');
      router.refresh();
    });
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Analiz Kuralları</h2>
        <p className="mt-1 text-sm text-slate-600">Stage-1 keyword listeleri ve birleşik yemek kurallarını buradan yönet.</p>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-800">Platter keyword listesi (satır bazlı)</span>
        <textarea
          className="min-h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={platterKeywordsText}
          onChange={(event) => setPlatterKeywordsText(event.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-800">Generic image prefix listesi (satır bazlı)</span>
        <textarea
          className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={genericImagePrefixesText}
          onChange={(event) => setGenericImagePrefixesText(event.target.value)}
        />
      </label>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Composite dish rules</h3>
        {rules.map((rule, index) => (
          <div key={rule.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{rule.id}</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(index, { enabled: event.target.checked })}
                  />
                  enabled
                </label>
                <Button type="button" size="sm" variant="ghost" disabled={!canMove || index === 0} onClick={() => moveRule(index, -1)}>
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!canMove || index === rules.length - 1}
                  onClick={() => moveRule(index, 1)}
                >
                  ↓
                </Button>
              </div>
            </div>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={rule.dishName}
              onChange={(event) => updateRule(index, { dishName: event.target.value })}
              placeholder="Yemek adı"
            />
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={rule.dishKeywords.join(', ')}
              onChange={(event) =>
                updateRule(index, {
                  dishKeywords: event.target.value.split(',').map((keyword) => keyword.trim()),
                })
              }
              placeholder="dish keywords (virgülle)"
            />
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={rule.componentKeywords.join(', ')}
              onChange={(event) =>
                updateRule(index, {
                  componentKeywords: event.target.value.split(',').map((keyword) => keyword.trim()),
                })
              }
              placeholder="component keywords (virgülle)"
            />
          </div>
        ))}
      </div>

      <Button type="button" fullWidth onClick={submit} disabled={isPending}>
        {isPending ? 'Kurallar kaydediliyor...' : 'Kuralları kaydet'}
      </Button>
    </Card>
  );
}
