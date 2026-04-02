'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function OrganizationCard({ org }: { org: { id: string; name: string; description: string; status: string; _count: { teams: number; employees: number } } }) {
  return (
    <div className="rounded-lg border p-4">
      <Link href={`/org/${org.id}`} className="block hover:underline">
        <h3 className="font-semibold">{org.name}</h3>
      </Link>
      <p className="mt-2 text-sm text-muted-foreground">{org._count.teams} teams · {org._count.employees} employees</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" className="px-2 py-1 text-xs" onClick={async () => {
          const name = window.prompt('Rename organization', org.name);
          if (!name) return;
          await fetch('/api/organizations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: org.id, name, description: org.description ?? '', status: org.status, tags: [], instructions: '', attributes: '{}' }) });
          window.location.reload();
        }}>Edit</Button>
        <Button type="button" className="bg-slate-200 px-2 py-1 text-xs text-slate-900" onClick={async () => {
          await fetch('/api/organizations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: org.id }) });
          window.location.reload();
        }}>Archive</Button>
      </div>
    </div>
  );
}
