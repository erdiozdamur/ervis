import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmployeeNode({ employeeId, name, selected, onEdit }: { employeeId: string; name: string; selected?: boolean; onEdit?: () => void }) {
  return (
    <div className={`min-w-56 rounded-2xl border p-3 text-sm shadow-lg transition ${selected ? 'border-teal-300/80 bg-slate-900 ring-2 ring-teal-300/30' : 'border-teal-300/35 bg-slate-900/95'}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-teal-200/90">
        <Bot size={13} />
        Employee
      </div>
      <div className="font-semibold text-slate-100">{name}</div>
      <div className="mt-1 text-[10px] text-slate-400">ID: {employeeId.slice(0, 8)}</div>
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
