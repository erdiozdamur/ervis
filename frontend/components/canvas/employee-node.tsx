import { Button } from '@/components/ui/button';

export function EmployeeNode({ employeeId, name, selected, onEdit }: { employeeId: string; name: string; selected?: boolean; onEdit?: () => void }) {
  return (
    <div className={`min-w-48 rounded-lg border-2 bg-white p-3 text-sm shadow transition ${selected ? 'border-emerald-700 ring-2 ring-emerald-200' : 'border-emerald-500'}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</div>
      <div className="font-semibold">🤖 {name}</div>
      <div className="mt-1 text-[10px] text-slate-500">ID: {employeeId.slice(0, 8)}</div>
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
