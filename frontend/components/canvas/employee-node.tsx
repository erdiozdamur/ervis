export function EmployeeNode({ name, title }: { name: string; title?: string | null }) {
  return (
    <div className="min-w-40 rounded-lg border-2 border-emerald-500 bg-white p-3 text-sm shadow">
      <div className="font-semibold">🤖 {name}</div>
      {title ? <div className="text-xs text-muted-foreground">{title}</div> : null}
    </div>
  );
}
