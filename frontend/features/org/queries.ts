import { prisma } from '@/db/client';

export async function listOrganizationsForUser(userId: string) {
  return prisma.organization.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { teams: true, employees: true } },
    },
  });
}

export async function getOrganizationGraph(organizationId: string) {
  const [teams, edges] = await Promise.all([
    prisma.team.findMany({ where: { organizationId } }),
    prisma.teamEdge.findMany({ where: { organizationId } }),
  ]);
  return { teams, edges };
}
