import { prisma } from '@/db/client';

export async function canAccessOrganization(userId: string, organizationId: string) {
  const count = await prisma.organization.count({ where: { id: organizationId, ownerId: userId } });
  return count > 0;
}

export async function canAccessTeam(userId: string, teamId: string) {
  const count = await prisma.team.count({
    where: { id: teamId, organization: { ownerId: userId } },
  });
  return count > 0;
}
