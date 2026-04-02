import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error('ADMIN_EMAIL is required for bootstrap');

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN },
    create: { email: adminEmail, name: 'System Admin', role: UserRole.ADMIN },
  });

  const capabilityKeys = [
    { key: 'search.web', label: 'Web Search' },
    { key: 'send.email', label: 'Send Email' },
    { key: 'run.workflow', label: 'Run Workflow' },
  ];

  for (const cap of capabilityKeys) {
    await prisma.capability.upsert({
      where: { key: cap.key },
      update: {},
      create: cap,
    });
  }

  const org = await prisma.organization.upsert({
    where: { id: 'seed-org' },
    update: {},
    create: {
      id: 'seed-org',
      ownerId: admin.id,
      name: 'Acme Virtual Org',
      context: 'Company context for all teams and employees',
      instructions: 'Operate safely and log all significant events.',
    },
  });

  const growth = await prisma.team.upsert({
    where: { id: 'seed-team-growth' },
    update: {},
    create: { id: 'seed-team-growth', organizationId: org.id, name: 'Growth Team', positionX: 80, positionY: 120, context: 'Growth context' },
  });
  const ops = await prisma.team.upsert({
    where: { id: 'seed-team-ops' },
    update: {},
    create: { id: 'seed-team-ops', organizationId: org.id, name: 'Ops Team', positionX: 380, positionY: 220, context: 'Ops context' },
  });

  await prisma.teamEdge.upsert({
    where: { id: 'seed-team-edge' },
    update: {},
    create: { id: 'seed-team-edge', organizationId: org.id, sourceTeamId: growth.id, targetTeamId: ops.id },
  });

  const a = await prisma.employee.upsert({
    where: { id: 'seed-employee-a' },
    update: {},
    create: { id: 'seed-employee-a', organizationId: org.id, teamId: growth.id, name: 'Ari Agent', title: 'Growth Analyst', positionX: 100, positionY: 100 },
  });
  const b = await prisma.employee.upsert({
    where: { id: 'seed-employee-b' },
    update: {},
    create: { id: 'seed-employee-b', organizationId: org.id, teamId: growth.id, name: 'Nova Agent', title: 'Content Planner', positionX: 320, positionY: 180 },
  });

  await prisma.employeeEdge.upsert({
    where: { id: 'seed-employee-edge' },
    update: {},
    create: { id: 'seed-employee-edge', teamId: growth.id, sourceEmployeeId: a.id, targetEmployeeId: b.id },
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
