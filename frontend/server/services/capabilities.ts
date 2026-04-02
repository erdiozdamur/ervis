import { prisma } from '@/db/client';

type CapabilityLike = { key: string; label: string; description: string | null };

export function resolveEffectiveCapabilitiesFromLists(input: { employee: CapabilityLike[]; teamDefault: CapabilityLike[]; includeTeamDefaults: boolean }) {
  const map = new Map<string, CapabilityLike>();
  if (input.includeTeamDefaults) {
    for (const cap of input.teamDefault) map.set(cap.key, cap);
  }
  for (const cap of input.employee) map.set(cap.key, cap);
  return [...map.values()];
}

export async function resolveEffectiveCapabilities(employeeId: string, includeTeamDefaults = true) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      capabilities: { include: { capability: true } },
      team: { include: { capabilities: { include: { capability: true } } } },
    },
  });

  if (!employee) return [];

  return resolveEffectiveCapabilitiesFromLists({
    employee: employee.capabilities.map((item) => item.capability),
    teamDefault: employee.team.capabilities.map((item) => item.capability),
    includeTeamDefaults,
  });
}
