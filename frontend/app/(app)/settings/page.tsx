import { TopBar } from '@/components/layout/top-bar';
import { requireAdmin } from '@/server/auth/session';

export default async function SettingsPage() {
  const user = await requireAdmin();
  return (
    <main>
      <TopBar title="Admin Settings" />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Admin-only system settings placeholder.</p>
        <p className="mt-2 text-sm">Signed in as {user.email}</p>
      </div>
    </main>
  );
}
