import { TopBar } from '@/components/layout/top-bar';
import { requireAdmin } from '@/server/auth/session';

export default async function SettingsPage() {
  const user = await requireAdmin();
  return (
    <main>
      <TopBar title="Admin Settings" subtitle="System-level configuration zone" />
      <div className="space-y-3 p-1">
        <section className="app-surface p-4">
          <p className="text-sm text-slate-300">Admin-only system settings placeholder.</p>
          <p className="mt-2 text-sm text-slate-400">Signed in as {user.email}</p>
        </section>
      </div>
    </main>
  );
}
