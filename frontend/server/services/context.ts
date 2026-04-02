import { ContextOwnerType, ContextSource } from '@prisma/client';
import { prisma } from '@/db/client';

type ResolvedContext = {
  inheritedFromOrganization: ContextSource[];
  inheritedFromTeam: ContextSource[];
  direct: ContextSource[];
};

export async function resolveInheritedContext(input: { ownerType: ContextOwnerType; ownerId: string }): Promise<ResolvedContext> {
  if (input.ownerType === 'ORGANIZATION') {
    const direct = await prisma.contextSource.findMany({ where: { ownerType: 'ORGANIZATION', ownerId: input.ownerId }, orderBy: { createdAt: 'desc' } });
    return { inheritedFromOrganization: [], inheritedFromTeam: [], direct };
  }

  if (input.ownerType === 'TEAM') {
    const team = await prisma.team.findUnique({ where: { id: input.ownerId }, select: { organizationId: true } });
    if (!team) return { inheritedFromOrganization: [], inheritedFromTeam: [], direct: [] };
    const [orgCtx, direct] = await Promise.all([
      prisma.contextSource.findMany({ where: { ownerType: 'ORGANIZATION', ownerId: team.organizationId }, orderBy: { createdAt: 'desc' } }),
      prisma.contextSource.findMany({ where: { ownerType: 'TEAM', ownerId: input.ownerId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { inheritedFromOrganization: orgCtx, inheritedFromTeam: [], direct };
  }

  const employee = await prisma.employee.findUnique({ where: { id: input.ownerId }, select: { organizationId: true, teamId: true } });
  if (!employee) return { inheritedFromOrganization: [], inheritedFromTeam: [], direct: [] };

  const [orgCtx, teamCtx, direct] = await Promise.all([
    prisma.contextSource.findMany({ where: { ownerType: 'ORGANIZATION', ownerId: employee.organizationId }, orderBy: { createdAt: 'desc' } }),
    prisma.contextSource.findMany({ where: { ownerType: 'TEAM', ownerId: employee.teamId }, orderBy: { createdAt: 'desc' } }),
    prisma.contextSource.findMany({ where: { ownerType: 'EMPLOYEE', ownerId: input.ownerId }, orderBy: { createdAt: 'desc' } }),
  ]);

  return { inheritedFromOrganization: orgCtx, inheritedFromTeam: teamCtx, direct };
}

export function resolveInheritedContextFromLists(input: { ownerType: ContextOwnerType; org: ContextSource[]; team: ContextSource[]; employee: ContextSource[] }): ResolvedContext {
  if (input.ownerType === 'ORGANIZATION') return { inheritedFromOrganization: [], inheritedFromTeam: [], direct: input.org };
  if (input.ownerType === 'TEAM') return { inheritedFromOrganization: input.org, inheritedFromTeam: [], direct: input.team };
  return { inheritedFromOrganization: input.org, inheritedFromTeam: input.team, direct: input.employee };
}
