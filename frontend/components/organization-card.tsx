import Link from 'next/link';

export function OrganizationCard({ org }: { org: { id: string; name: string; _count: { teams: number; employees: number } } }) {
  return (
    <Link href={`/org/${org.id}`} className="rounded-lg border p-4 hover:bg-muted/50">
      <h3 className="font-semibold">{org.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{org._count.teams} teams · {org._count.employees} employees</p>
    </Link>
  );
}
