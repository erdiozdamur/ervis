import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Edge, Node } from 'reactflow';
import { TopBar } from '@/components/layout/top-bar';
import { OrgCanvas } from '@/components/canvas/org-canvas';
import { ActivityLogPanel } from '@/components/activity-log-panel';
import { CreateTeamForm } from '@/components/create-team-form';
import { OrganizationEditorPanel } from '@/components/organization-editor-panel';
import { getOrganizationGraph } from '@/features/org/queries';
import { prisma } from '@/db/client';
import { requireUser } from '@/server/auth/session';
import { canAccessOrganization } from '@/server/auth/access';

export const dynamic = 'force-dynamic';

type OrganizationGraph = Awaited<ReturnType<typeof getOrganizationGraph>>;
type GraphTeam = OrganizationGraph['teams'][number];
type GraphEdge = OrganizationGraph['edges'][number];

export default async function OrganizationPage({ params }: { params: { organizationId: string } }) {
  const user = await requireUser();
  const access = await canAccessOrganization(user.id, params.organizationId);
  if (!access) notFound();

  const { organization, teams, edges } = await getOrganizationGraph(params.organizationId);
  if (!organization) notFound();
  const logs = await prisma.auditLog.findMany({ where: { organizationId: params.organizationId }, orderBy: { createdAt: 'desc' }, take: 20 });

  const nodes: Node[] = teams.map((team: GraphTeam) => ({
    id: team.id,
    type: 'team',
    position: { x: team.positionX, y: team.positionY },
    data: { name: team.name, instructions: team.instructions },
  }));

  const flowEdges: Edge[] = edges.map((edge: GraphEdge) => ({
    id: edge.id,
    source: edge.sourceTeamId,
    target: edge.targetTeamId,
    label: edge.label ?? edge.edgeType,
    data: { edgeType: edge.edgeType },
  }));

  return (
    <main>
      <TopBar title="Organization Canvas" subtitle={`${organization.name} · team topology and hierarchy design`} />
      <div className="space-y-4 p-1">
        <div className="app-surface flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Organization</div>
            <div className="text-base font-semibold text-white">{organization.name}</div>
            <div className="mt-1 text-xs text-slate-400">{teams.length} teams · {edges.length} hierarchy edges</div>
          </div>
          <OrganizationEditorPanel organization={organization} />
        </div>
        <CreateTeamForm organizationId={params.organizationId} />
        <OrgCanvas initialNodes={nodes} initialEdges={flowEdges} organizationId={params.organizationId} />
        <ActivityLogPanel logs={logs} />
        <div className="app-surface p-4 text-sm text-slate-300">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Quick Team Access</div>
          {teams.length ? teams.map((team: GraphTeam) => (
            <Link key={team.id} className="mr-3 inline-flex rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10" href={`/team/${team.id}`}>
              {team.name}
            </Link>
          )) : <span className="text-slate-500">No teams yet.</span>}
        </div>
      </div>
    </main>
  );
}
