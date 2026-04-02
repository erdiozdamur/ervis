export function EmployeeNode({ name, title, selected }: { name: string; title?: string | null; selected?: boolean }) {
  return (
    <div className={`min-w-44 rounded-lg border-2 bg-white p-3 text-sm shadow transition ${selected ? 'border-emerald-700 ring-2 ring-emerald-200' : 'border-emerald-500'}`}>
      <div className="font-semibold">🤖 {name}</div>
      {title ? <div className="text-xs text-muted-foreground">{title}</div> : null}
    </div>
  );
}
