import { notFound } from 'next/navigation';
import { Edge, Node } from 'reactflow';
import { TopBar } from '@/components/layout/top-bar';
import { TeamCanvas } from '@/components/canvas/team-canvas';
import { ActivityLogPanel } from '@/components/activity-log-panel';
import { CreateEmployeeForm } from '@/components/create-employee-form';
import { getTeamGraph } from '@/features/team/queries';
import { prisma } from '@/db/client';
import { requireUser } from '@/server/auth/session';
import { canAccessTeam } from '@/server/auth/access';

type TeamGraph = Awaited<ReturnType<typeof getTeamGraph>>;
type TeamEmployee = TeamGraph['employees'][number];
type TeamEdge = TeamGraph['edges'][number];

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const user = await requireUser();
  const access = await canAccessTeam(user.id, params.teamId);
  if (!access) notFound();

  const { employees, edges, team } = await getTeamGraph(params.teamId);
  if (!team) notFound();

  const logs = await prisma.auditLog.findMany({ where: { organizationId: team.organizationId }, orderBy: { createdAt: 'desc' }, take: 20 });

  const nodes: Node[] = employees.map((employee: TeamEmployee) => ({
    id: employee.id,
    type: 'employee',
    position: { x: employee.positionX, y: employee.positionY },
    data: { name: employee.name, description: employee.description, status: employee.status, tags: employee.tags, instructions: employee.instructions, attributes: employee.attributes, title: employee.title, specialization: employee.specialization, modelPreference: employee.modelPreference, active: employee.active },
  }));

  const flowEdges: Edge[] = edges.map((edge: TeamEdge) => ({
    id: edge.id,
    source: edge.sourceEmployeeId,
    target: edge.targetEmployeeId,
    label: edge.label ?? edge.edgeType,
    data: { edgeType: edge.edgeType },
  }));

  return (
    <main>
      <TopBar title={`Team Canvas · ${team.name}`} />
      <div className="space-y-3 p-4">
        <CreateEmployeeForm organizationId={team.organizationId} teamId={params.teamId} />
        <TeamCanvas initialNodes={nodes} initialEdges={flowEdges} teamId={params.teamId} organizationId={team.organizationId} />
        <ActivityLogPanel logs={logs} />
      </div>
    </main>
  );
}
