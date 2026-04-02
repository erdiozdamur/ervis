export function PropertiesPanel({ data }: { data?: Record<string, unknown> }) {
  return (
    <aside className="w-72 border-l p-3">
      <h3 className="mb-2 font-semibold">Properties</h3>
      <pre className="overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(data ?? {}, null, 2)}</pre>
    </aside>
  );
}
