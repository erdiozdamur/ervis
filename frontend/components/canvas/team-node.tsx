import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function TeamNode({ teamId, name, selected, onEdit }: { teamId: string; name: string; selected?: boolean; onEdit?: () => void }) {
  return (
    <div className={`min-w-48 rounded-lg border-2 bg-white p-3 text-sm shadow transition ${selected ? 'border-blue-700 ring-2 ring-blue-200' : 'border-blue-500'}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Team</div>
      <Link href={`/team/${teamId}`} className="block text-sm font-semibold text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>
        {name}
      </Link>
      <Button
        type="button"
        className="mt-2 h-7 w-full bg-slate-200 px-2 py-1 text-xs text-slate-900"
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
