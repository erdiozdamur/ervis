import { TopBar } from '@/components/layout/top-bar';
import { OrganizationCard } from '@/components/organization-card';
import { listOrganizationsForUser } from '@/features/org/queries';
import { CreateOrganizationForm } from '@/components/create-organization-form';
import { requireUser } from '@/server/auth/session';

type OrganizationListItem = Awaited<ReturnType<typeof listOrganizationsForUser>>[number];

export default async function DashboardPage() {
  const user = await requireUser();
  const organizations = await listOrganizationsForUser(user.id);
  const totalTeams = organizations.reduce((sum, org) => sum + org._count.teams, 0);
  const totalEmployees = organizations.reduce((sum, org) => sum + org._count.employees, 0);

  return (
    <main>
      <TopBar title="Dashboard" subtitle="Organizasyonlarını, ekiplerini ve operasyon akışını tek noktadan yönet." />
      <div className="space-y-4 p-1">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="app-surface p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Organizations</p>
            <p className="mt-2 text-2xl font-semibold text-white">{organizations.length}</p>
          </div>
          <div className="app-surface p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Teams</p>
            <p className="mt-2 text-2xl font-semibold text-white">{totalTeams}</p>
          </div>
          <div className="app-surface p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Employees</p>
            <p className="mt-2 text-2xl font-semibold text-white">{totalEmployees}</p>
          </div>
        </div>

        <CreateOrganizationForm />
        <h2 className="text-lg font-semibold text-white">Your Organizations</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizations.length === 0 ? <p className="app-surface p-4 text-sm text-slate-300">No organizations yet. Create your first organization to start modeling your structure.</p> : organizations.map((org: OrganizationListItem) => (
            <OrganizationCard key={org.id} org={org} />
          ))}
        </div>
      </div>
    </main>
  );
}
