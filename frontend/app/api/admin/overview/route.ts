import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdmin } from '@/lib/auth/admin';

async function getLatestVersion(namespace: string, key: string) {
  const row = await prisma.appMeta.findUnique({
    where: { namespace_key: { namespace, key } },
    select: { version: true, publishedAt: true, publishedBy: true },
  });

  return row
    ? {
        version: row.version,
        publishedAt: row.publishedAt,
        publishedBy: row.publishedBy,
      }
    : null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const [totalUsers, activeUsers, adminUsers, latestAudit, aiModelVersion, promptVersion, appSettingsVersion, featureFlagsVersion] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true, role: { in: ['ADMIN', 'SUPER_ADMIN', 'OWNER'] } } }),
      prisma.adminAuditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              email: true,
            },
          },
        },
      }),
      getLatestVersion('ai', 'mealModel'),
      getLatestVersion('ai', 'analysisPromptVersion'),
      getLatestVersion('app', 'timeZone'),
      getLatestVersion('app', 'featureFlags'),
    ]);

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers,
      activeUsers,
      adminUsers,
      passiveUsers: Math.max(0, totalUsers - activeUsers),
    },
    versions: {
      aiModel: aiModelVersion,
      prompt: promptVersion,
      appSettings: appSettingsVersion,
      featureFlags: featureFlagsVersion,
    },
    latestAudit: latestAudit
      ? {
          id: latestAudit.id,
          action: latestAudit.action,
          resourceType: latestAudit.resourceType,
          resourceKey: latestAudit.resourceKey,
          createdAt: latestAudit.createdAt,
          actorEmail: latestAudit.actor.email,
        }
      : null,
  });
}
