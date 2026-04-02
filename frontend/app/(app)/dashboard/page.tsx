import { TopBar } from '@/components/layout/top-bar';
import { OrganizationCard } from '@/components/organization-card';
import { listOrganizationsForUser } from '@/features/org/queries';
import { CreateOrganizationForm } from '@/components/create-organization-form';
import { requireUser } from '@/server/auth/session';

export default async function DashboardPage() {
  const user = await requireUser();
  const organizations = await listOrganizationsForUser(user.id);

  return (
    <main>
      <TopBar title="Dashboard" />
      <div className="p-6">
        <CreateOrganizationForm />
        <h2 className="mb-4 text-xl font-semibold">Your organizations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} org={org} />
          ))}
        </div>
      </div>
    </main>
  );
}
