import Link from 'next/link';

export function AppSidebar() {
  return (
    <aside className="w-64 border-r bg-muted/40 p-4">
      <h2 className="mb-6 text-lg font-semibold">Ervis</h2>
      <nav className="space-y-2 text-sm">
        <Link className="block rounded px-2 py-1 hover:bg-muted" href="/dashboard">Dashboard</Link>
        <Link className="block rounded px-2 py-1 hover:bg-muted" href="/settings">Settings</Link>
      </nav>
    </aside>
  );
}
