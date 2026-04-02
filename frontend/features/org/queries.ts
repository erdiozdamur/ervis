import { prisma } from '@/db/client';

export async function listOrganizationsForUser(userId: string) {
  return prisma.organization.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { teams: true, employees: true } } },
  });
}

export async function getOrganizationGraph(organizationId: string) {
  const [organization, teams, edges] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.team.findMany({ where: { organizationId, status: 'ACTIVE' } }),
    prisma.teamEdge.findMany({ where: { organizationId } }),
  ]);
  return { organization, teams, edges };
}
