import { prisma } from '@/db/client';

export function organizationOwnershipWhere(userId: string, organizationId: string) {
  return { id: organizationId, ownerId: userId };
}

export function teamOwnershipWhere(userId: string, teamId: string) {
  return { id: teamId, organization: { ownerId: userId } };
}

export function employeeOwnershipWhere(userId: string, employeeId: string) {
  return { id: employeeId, organization: { ownerId: userId } };
}

export async function canAccessOrganization(userId: string, organizationId: string) {
  const count = await prisma.organization.count({ where: organizationOwnershipWhere(userId, organizationId) });
  return count > 0;
}

export async function canAccessTeam(userId: string, teamId: string) {
  const count = await prisma.team.count({ where: teamOwnershipWhere(userId, teamId) });
  return count > 0;
}

export async function canAccessEmployee(userId: string, employeeId: string) {
  const count = await prisma.employee.count({ where: employeeOwnershipWhere(userId, employeeId) });
  return count > 0;
}

export async function canAccessContextOwner(userId: string, ownerType: 'ORGANIZATION' | 'TEAM' | 'EMPLOYEE', ownerId: string) {
  if (ownerType === 'ORGANIZATION') return canAccessOrganization(userId, ownerId);
  if (ownerType === 'TEAM') return canAccessTeam(userId, ownerId);
  return canAccessEmployee(userId, ownerId);
}
