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
        <Link href={`/org/${org.id}`}>
          <Button type="button" className="px-2 py-1 text-xs">Open</Button>
        </Link>
      </div>
    </div>
  );
}
