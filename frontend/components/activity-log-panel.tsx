'use client';

import { useMemo, useState } from 'react';

type Log = { id: string; action: string; subjectType: string; createdAt: Date };

export function ActivityLogPanel({ logs }: { logs: Log[] }) {
  const [subjectType, setSubjectType] = useState('all');
  const [action, setAction] = useState('all');

  const filtered = useMemo(
    () => logs.filter((log) => (subjectType === 'all' || log.subjectType === subjectType) && (action === 'all' || log.action === action)),
    [action, logs, subjectType],
  );

  return (
    <section className="h-64 overflow-auto border-t p-3">
      <h3 className="mb-2 font-semibold">Activity</h3>
      <div className="mb-2 flex gap-2 text-xs">
        <select className="rounded border px-2 py-1" value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          <option value="all">All entities</option>
          {[...new Set(logs.map((log) => log.subjectType))].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className="rounded border px-2 py-1" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">All events</option>
          {[...new Set(logs.map((log) => log.action))].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
      <ul className="space-y-1 text-xs">
        {filtered.map((log) => (
          <li key={log.id} className="rounded bg-muted p-2">
            <div>{log.action} · {log.subjectType}</div>
            <div className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
