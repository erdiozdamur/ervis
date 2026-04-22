'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusPill } from '@/components/ui/status-pill';

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceKey: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    role: string;
  };
};

type AuditLogsResponse = {
  ok: true;
  logs: AuditLog[];
};

type DiffRow = {
  path: string;
  beforeValue: string;
  afterValue: string;
  changed: boolean;
};

function normalizeDateInput(value: string, mode: 'start' | 'end') {
  if (!value) {
    return '';
  }

  const suffix = mode === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return `${value}${suffix}`;
}

function toFlatMap(value: unknown, prefix = '', target: Record<string, string> = {}) {
  if (value === null || value === undefined) {
    target[prefix || '(root)'] = 'null';
    return target;
  }

  if (typeof value !== 'object') {
    target[prefix || '(root)'] = String(value);
    return target;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      toFlatMap(item, `${prefix}[${index}]`, target);
    });
    return target;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    target[prefix || '(root)'] = '{}';
    return target;
  }

  entries.forEach(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    toFlatMap(nestedValue, nextPrefix, target);
  });

  return target;
}

function buildDiffRows(beforeJson: unknown, afterJson: unknown): DiffRow[] {
  const beforeMap = toFlatMap(beforeJson);
  const afterMap = toFlatMap(afterJson);

  const keys = Array.from(new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])).sort((a, b) => a.localeCompare(b));

  return keys.map((key) => ({
    path: key,
    beforeValue: beforeMap[key] ?? '-',
    afterValue: afterMap[key] ?? '-',
    changed: (beforeMap[key] ?? '-') !== (afterMap[key] ?? '-'),
  }));
}

export function AuditLogsPanel() {
  const [actorFilter, setActorFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '200');

      if (actorFilter.trim()) {
        params.set('actor', actorFilter.trim());
      }

      if (resourceFilter.trim()) {
        params.set('resourceType', resourceFilter.trim());
      }

      const normalizedDateFrom = normalizeDateInput(dateFrom, 'start');
      const normalizedDateTo = normalizeDateInput(dateTo, 'end');

      if (normalizedDateFrom) {
        params.set('dateFrom', normalizedDateFrom);
      }

      if (normalizedDateTo) {
        params.set('dateTo', normalizedDateTo);
      }

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as AuditLogsResponse | { message?: string };

      if (!response.ok) {
        const message = 'message' in payload ? payload.message : undefined;
        throw new Error(message ?? 'Audit log listesi alınamadı.');
      }

      setLogs(payload.logs);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actorFilter, dateFrom, dateTo, resourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const diffRows = useMemo(() => {
    if (!selectedLog) {
      return [];
    }

    return buildDiffRows(selectedLog.beforeJson, selectedLog.afterJson);
  }, [selectedLog]);

  async function exportCsv() {
    const params = new URLSearchParams();
    params.set('limit', '500');
    params.set('format', 'csv');

    if (actorFilter.trim()) {
      params.set('actor', actorFilter.trim());
    }

    if (resourceFilter.trim()) {
      params.set('resourceType', resourceFilter.trim());
    }

    const normalizedDateFrom = normalizeDateInput(dateFrom, 'start');
    const normalizedDateTo = normalizeDateInput(dateTo, 'end');

    if (normalizedDateFrom) {
      params.set('dateFrom', normalizedDateFrom);
    }

    if (normalizedDateTo) {
      params.set('dateTo', normalizedDateTo);
    }

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);

    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setError(payload.message ?? 'CSV export başarısız oldu.');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        <Input value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} placeholder="Actor e-posta filtresi" className="h-12 md:col-span-2" />
        <Input value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)} placeholder="Resource type filtresi" className="h-12" />
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-12" />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-12" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={fetchLogs}>
          Filtreyi uygula
        </Button>
        <Button variant="ghost" onClick={exportCsv}>
          CSV export (opsiyonel)
        </Button>
      </div>

      {loading ? <StatePanel variant="loading" title="Audit logs yükleniyor" description="Kayıtlar hazırlanıyor..." /> : null}
      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}

      {!loading && !error && logs.length === 0 ? (
        <StatePanel variant="empty" title="Audit kaydı bulunamadı" description="Actor/resource/date filtrelerini kontrol edip tekrar deneyin." />
      ) : null}

      {!loading && !error && logs.length > 0 ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-slate-700">{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{log.actor.email}</div>
                    <div className="text-xs text-slate-500">{log.actor.role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone="neutral">{log.action}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{log.resourceType}</div>
                    <div className="text-xs text-slate-500">{log.resourceKey}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedLog(log)}>
                      Before/After diff
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <BottomSheet
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Detay modalı"
        description={selectedLog ? `${selectedLog.action} · ${selectedLog.resourceType}` : undefined}
      >
        {diffRows.length === 0 ? (
          <p className="text-sm text-slate-600">Bu kayıt için karşılaştırılacak before/after alanı yok.</p>
        ) : (
          <ul className="space-y-2">
            {diffRows.map((row) => (
              <li key={row.path} className="rounded-2xl border border-slate-200 p-3 text-sm">
                <div className="font-semibold text-slate-900">{row.path}</div>
                <div className="mt-1 text-slate-600">before: {row.beforeValue}</div>
                <div className="text-slate-700">after: {row.afterValue}</div>
                <div className={`mt-1 text-xs font-semibold ${row.changed ? 'text-amber-700' : 'text-slate-500'}`}>
                  {row.changed ? 'değişti' : 'aynı'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  );
}
