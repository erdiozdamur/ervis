import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Edge, Node } from 'reactflow';
import { TopBar } from '@/components/layout/top-bar';
import { OrgCanvas } from '@/components/canvas/org-canvas';
import { ActivityLogPanel } from '@/components/activity-log-panel';
import { CreateTeamForm } from '@/components/create-team-form';
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
    data: { name: team.name, description: team.description, status: team.status, tags: team.tags, instructions: team.instructions, attributes: team.attributes, rolePurpose: team.rolePurpose },
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
      <TopBar title="Organization Canvas" />
      <div className="space-y-3 p-4">
        <CreateTeamForm organizationId={params.organizationId} />
        <OrgCanvas initialNodes={nodes} initialEdges={flowEdges} organizationId={params.organizationId} />
        <ActivityLogPanel logs={logs} />
        <div className="text-sm">
          Open a team: {teams.map((team: GraphTeam) => <Link key={team.id} className="mr-3 underline" href={`/team/${team.id}`}>{team.name}</Link>)}
        </div>
      </div>
    </main>
  );
}
