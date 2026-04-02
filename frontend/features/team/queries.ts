import { prisma } from '@/db/client';

export async function getTeamGraph(teamId: string) {
  const [employees, edges, team] = await Promise.all([
    prisma.employee.findMany({ where: { teamId, status: 'ACTIVE' }, include: { capabilities: { include: { capability: true } } } }),
    prisma.employeeEdge.findMany({ where: { teamId } }),
    prisma.team.findUnique({ where: { id: teamId }, include: { organization: true } }),
  ]);

  return { employees, edges, team };
}
