import { notFound } from 'next/navigation';
import { Edge, Node } from 'reactflow';
import { OrgCanvas } from '@/components/canvas/org-canvas';
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
    <main className="-mx-3 -mt-14 h-[calc(100vh-1.5rem)] sm:-mx-5 lg:-mx-8 lg:-mt-3">
      <OrgCanvas
        initialNodes={nodes}
        initialEdges={flowEdges}
        organizationId={params.organizationId}
        organization={organization}
        teams={teams.map((team: GraphTeam) => ({ id: team.id, name: team.name }))}
        logs={logs}
      />
    </main>
  );
}
