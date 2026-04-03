'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type Log = { id: string; action: string; subjectType: string; createdAt: Date | string };

export function ActivityLogPanel({ logs, className }: { logs: Log[]; className?: string }) {
  const [subjectType, setSubjectType] = useState('all');
  const [action, setAction] = useState('all');

  const filtered = useMemo(
    () => logs.filter((log) => (subjectType === 'all' || log.subjectType === subjectType) && (action === 'all' || log.action === action)),
    [action, logs, subjectType],
  );

  return (
    <section className={cn('app-surface h-64 overflow-auto p-3', className)}>
      <h3 className="mb-2 font-semibold text-slate-100">Activity</h3>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <select className="field-select h-9 min-w-40" value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          <option value="all">All entities</option>
          {[...new Set(logs.map((log) => log.subjectType))].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className="field-select h-9 min-w-40" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">All events</option>
          {[...new Set(logs.map((log) => log.action))].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
      <ul className="space-y-1 text-xs">
        {filtered.map((log) => (
          <li key={log.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-2">
            <div className="text-slate-200">{log.action} · {log.subjectType}</div>
            <div className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
