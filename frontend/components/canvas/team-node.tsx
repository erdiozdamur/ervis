import Link from 'next/link';
import { Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TeamNode({ teamId, name, selected, onEdit }: { teamId: string; name: string; selected?: boolean; onEdit?: () => void }) {
  return (
    <div className={`min-w-56 rounded-2xl border p-3 text-sm shadow-lg transition ${selected ? 'border-cyan-300/80 bg-slate-900 ring-2 ring-cyan-300/30' : 'border-cyan-300/35 bg-slate-900/95'}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">
        <Layers3 size={13} />
        Team
      </div>
      <Link href={`/team/${teamId}`} className="block text-sm font-semibold text-slate-100 hover:text-cyan-100 hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 h-8 w-full rounded-lg text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
      >
        Edit
      </Button>
    </div>
  );
}
