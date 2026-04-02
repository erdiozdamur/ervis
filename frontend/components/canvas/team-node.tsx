export function TeamNode({ name, selected }: { name: string; selected?: boolean }) {
  return (
    <div className={`min-w-44 rounded-lg border-2 bg-white p-3 text-sm font-semibold shadow transition ${selected ? 'border-blue-700 ring-2 ring-blue-200' : 'border-blue-500'}`}>
      🏢 {name}
    </div>
  );
}
