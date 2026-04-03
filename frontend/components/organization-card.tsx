'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Users } from 'lucide-react';
import { EntityStatus } from '@prisma/client';
import { OrganizationEditorPanel } from '@/components/organization-editor-panel';
import { Button } from '@/components/ui/button';

export function OrganizationCard({
  org,
}: {
  org: {
    id: string;
    name: string;
    description: string;
    status: EntityStatus;
    tags: string[];
    instructions: string;
    attributes: unknown;
    _count: { teams: number; employees: number };
  };
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/12 bg-slate-900/75 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_16px_40px_-22px_rgba(34,211,238,0.8)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-400/8 to-transparent" />
      <Link href={`/org/${org.id}`} className="relative block">
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/10 text-cyan-200">
          <Building2 size={16} />
        </div>
        <h3 className="font-semibold text-white transition group-hover:text-cyan-100">{org.name}</h3>
      </Link>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
        <Users size={14} className="text-cyan-200/90" />
        <span>{org._count.teams} teams</span>
        <span className="text-slate-500">•</span>
        <span>{org._count.employees} employees</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/org/${org.id}`}>
          <Button type="button" size="sm" className="rounded-lg">
            Open
            <ArrowRight size={14} />
          </Button>
        </Link>
        <OrganizationEditorPanel organization={org} triggerClassName="rounded-lg" />
      </div>
    </article>
  );
}
