import { EdgeType, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error('ADMIN_EMAIL is required for bootstrap');

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN },
    create: { email: adminEmail, name: 'System Admin', role: UserRole.ADMIN },
  });

  const seededCapabilities = [
    { key: 'web_search', label: 'Web Search' },
    { key: 'summarize_text', label: 'Summarize Text' },
    { key: 'classify_content', label: 'Classify Content' },
    { key: 'route_task', label: 'Route Task' },
    { key: 'write_analysis', label: 'Write Analysis' },
    { key: 'review_output', label: 'Review Output' },
    { key: 'send_email', label: 'Send Email' },
  ];

  const capabilityMap = new Map<string, string>();
  for (const cap of seededCapabilities) {
    const record = await prisma.capability.upsert({ where: { key: cap.key }, update: { label: cap.label }, create: cap });
    capabilityMap.set(cap.key, record.id);
  }

  const org = await prisma.organization.upsert({
    where: { id: 'seed-org' },
    update: {},
    create: {
      id: 'seed-org',
      ownerId: admin.id,
      name: 'Acme Virtual Org',
      description: 'Seeded demonstration organization',
      instructions: 'Operate safely and log all significant events.',
      tags: ['seeded', 'demo'],
    },
  });

  const growth = await prisma.team.upsert({ where: { id: 'seed-team-growth' }, update: {}, create: { id: 'seed-team-growth', organizationId: org.id, name: 'Growth Team', positionX: 80, positionY: 120 } });
  const ops = await prisma.team.upsert({ where: { id: 'seed-team-ops' }, update: {}, create: { id: 'seed-team-ops', organizationId: org.id, name: 'Ops Team', positionX: 380, positionY: 220 } });
  const qa = await prisma.team.upsert({ where: { id: 'seed-team-qa' }, update: {}, create: { id: 'seed-team-qa', organizationId: org.id, name: 'QA Team', positionX: 660, positionY: 150 } });

  await prisma.teamEdge.upsert({ where: { id: 'seed-team-edge-1' }, update: {}, create: { id: 'seed-team-edge-1', organizationId: org.id, sourceTeamId: growth.id, targetTeamId: ops.id, edgeType: EdgeType.HIERARCHY, label: 'handoff' } });
  await prisma.teamEdge.upsert({ where: { id: 'seed-team-edge-2' }, update: {}, create: { id: 'seed-team-edge-2', organizationId: org.id, sourceTeamId: ops.id, targetTeamId: qa.id, edgeType: EdgeType.APPROVAL, label: 'approval' } });

  const a = await prisma.employee.upsert({ where: { id: 'seed-employee-a' }, update: {}, create: { id: 'seed-employee-a', organizationId: org.id, teamId: growth.id, name: 'Ari Agent', positionX: 100, positionY: 100 } });
  const b = await prisma.employee.upsert({ where: { id: 'seed-employee-b' }, update: {}, create: { id: 'seed-employee-b', organizationId: org.id, teamId: growth.id, name: 'Nova Agent', positionX: 320, positionY: 180 } });
  const c = await prisma.employee.upsert({ where: { id: 'seed-employee-c' }, update: {}, create: { id: 'seed-employee-c', organizationId: org.id, teamId: ops.id, name: 'Rune Agent', positionX: 180, positionY: 220 } });

  await prisma.employeeEdge.upsert({ where: { id: 'seed-employee-edge-1' }, update: {}, create: { id: 'seed-employee-edge-1', teamId: growth.id, sourceEmployeeId: a.id, targetEmployeeId: b.id, edgeType: EdgeType.HANDOFF, label: 'analysis to planning' } });
  await prisma.employeeEdge.upsert({ where: { id: 'seed-employee-edge-2' }, update: {}, create: { id: 'seed-employee-edge-2', teamId: growth.id, sourceEmployeeId: b.id, targetEmployeeId: a.id, edgeType: EdgeType.FEEDBACK_LOOP, label: 'feedback' } });

  await prisma.teamCapability.upsert({ where: { teamId_capabilityId: { teamId: growth.id, capabilityId: capabilityMap.get('route_task')! } }, update: {}, create: { teamId: growth.id, capabilityId: capabilityMap.get('route_task')!, grantedById: admin.id } });
  await prisma.teamCapability.upsert({ where: { teamId_capabilityId: { teamId: growth.id, capabilityId: capabilityMap.get('summarize_text')! } }, update: {}, create: { teamId: growth.id, capabilityId: capabilityMap.get('summarize_text')!, grantedById: admin.id } });
  await prisma.employeeCapability.upsert({ where: { employeeId_capabilityId: { employeeId: a.id, capabilityId: capabilityMap.get('web_search')! } }, update: {}, create: { employeeId: a.id, capabilityId: capabilityMap.get('web_search')!, grantedById: admin.id } });
  await prisma.employeeCapability.upsert({ where: { employeeId_capabilityId: { employeeId: b.id, capabilityId: capabilityMap.get('write_analysis')! } }, update: {}, create: { employeeId: b.id, capabilityId: capabilityMap.get('write_analysis')!, grantedById: admin.id } });

  await prisma.contextSource.createMany({
    data: [
      { organizationId: org.id, ownerType: 'ORGANIZATION', ownerId: org.id, title: 'Brand voice', type: 'NOTE', content: 'Use concise, friendly tone.' },
      { organizationId: org.id, ownerType: 'TEAM', ownerId: growth.id, title: 'Growth playbook', type: 'DOCUMENT_REFERENCE', content: 'playbooks/growth-v1.md' },
      { organizationId: org.id, ownerType: 'EMPLOYEE', ownerId: a.id, title: 'Ari scratchpad', type: 'TEXT', content: 'Watch AI search trends weekly.' },
    ],
    skipDuplicates: true,
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'ORGANIZATION_CREATED',
      subjectType: 'Organization',
      subjectId: org.id,
    },
  });
}

main().finally(async () => prisma.$disconnect());
