import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { isSuperAdminRole, requireAdmin, requireSuperAdmin } from '@/lib/auth/admin';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { APP_NAME, DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getServerEnv } from '@/lib/env';
import { withAdminWriteProtection, withCsrfToken } from '@/lib/security/admin-write-guard';

type AppSettingsConfig = {
  appName: string;
  supportEmail: string;
  timeZone: string;
  uploadMaxFileSizeMb: number;
  experimentalFeatureFlags: string[];
  mealDraftReviewEnabled: boolean;
  mealDraftReviewRolloutPercentage: number;
  version: number;
  lastPublishedBy: string | null;
};

const appSettingsSchema = z.object({
  appName: z.string().trim().min(2).max(120),
  supportEmail: z.string().trim().email().max(191),
  timeZone: z.string().trim().min(1).max(120),
  uploadMaxFileSizeMb: z.coerce.number().positive().max(512),
  experimentalFeatureFlags: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
  mealDraftReviewEnabled: z.boolean().default(false),
  mealDraftReviewRolloutPercentage: z.coerce.number().int().min(0).max(100).default(0),
});

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeFlags(flags: string[]) {
  const normalized = new Set<string>();

  for (const flag of flags) {
    const sanitized = flag.trim().toLowerCase();
    if (sanitized.length > 0) {
      normalized.add(sanitized);
    }
  }

  return Array.from(normalized).sort();
}

function getDefaults(): Omit<AppSettingsConfig, 'version' | 'lastPublishedBy'> {
  const env = getServerEnv();

  return {
    appName: APP_NAME,
    supportEmail: 'destek@ervis.app',
    timeZone: env.APP_TIME_ZONE ?? DEFAULT_APP_TIME_ZONE,
    uploadMaxFileSizeMb: env.MEAL_ASSET_MAX_FILE_SIZE_MB,
    experimentalFeatureFlags: [],
    mealDraftReviewEnabled: false,
    mealDraftReviewRolloutPercentage: 0,
  };
}

async function loadCurrentAppSettingsConfig(): Promise<AppSettingsConfig> {
  const rows = await prisma.appMeta.findMany({
    where: {
      OR: [
        { namespace: 'app', key: { in: ['name', 'supportEmail', 'timeZone', 'uploadValidation', 'featureFlags'] } },
        { namespace: 'feature', key: 'mealDraftReview' },
      ],
    },
    select: {
      namespace: true,
      key: true,
      valueJson: true,
      version: true,
      publishedBy: true,
    },
  });

  const defaults = getDefaults();
  const rowMap = new Map(rows.map((row) => [`${row.namespace}.${row.key}`, row]));

  return {
    appName: (rowMap.get('app.name')?.valueJson as { name?: string } | null)?.name ?? defaults.appName,
    supportEmail: (rowMap.get('app.supportEmail')?.valueJson as { email?: string } | null)?.email ?? defaults.supportEmail,
    timeZone: (rowMap.get('app.timeZone')?.valueJson as { timeZone?: string } | null)?.timeZone ?? defaults.timeZone,
    uploadMaxFileSizeMb:
      (rowMap.get('app.uploadValidation')?.valueJson as { maxFileSizeMb?: number } | null)?.maxFileSizeMb ?? defaults.uploadMaxFileSizeMb,
    experimentalFeatureFlags: normalizeFlags((rowMap.get('app.featureFlags')?.valueJson as { flags?: string[] } | null)?.flags ?? defaults.experimentalFeatureFlags),
    mealDraftReviewEnabled:
      (rowMap.get('feature.mealDraftReview')?.valueJson as { enabled?: boolean } | null)?.enabled ?? defaults.mealDraftReviewEnabled,
    mealDraftReviewRolloutPercentage:
      (rowMap.get('feature.mealDraftReview')?.valueJson as { rolloutPercentage?: number } | null)?.rolloutPercentage ?? defaults.mealDraftReviewRolloutPercentage,
    version: Math.max(...rows.map((row) => row.version), 1),
    lastPublishedBy: rows[0]?.publishedBy ?? null,
  };
}

async function loadRecentChanges() {
  return prisma.adminAuditLog.findMany({
    where: {
      resourceType: 'app_meta',
      resourceKey: 'app.settings',
      action: {
        in: ['app_settings_updated', 'app_settings_reset', 'app_settings_imported'],
      },
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });
}

async function publishAppSettings(config: z.infer<typeof appSettingsSchema>, actorId: string, version: number) {
  const publishedAt = new Date();
  const flags = normalizeFlags(config.experimentalFeatureFlags);

  await prisma.$transaction([
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'app', key: 'name' } },
      update: {
        valueJson: toJsonValue({ name: config.appName }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['name'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'app',
        key: 'name',
        valueJson: toJsonValue({ name: config.appName }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['name'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'app', key: 'supportEmail' } },
      update: {
        valueJson: toJsonValue({ email: config.supportEmail }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['email'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'app',
        key: 'supportEmail',
        valueJson: toJsonValue({ email: config.supportEmail }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['email'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'app', key: 'timeZone' } },
      update: {
        valueJson: toJsonValue({ timeZone: config.timeZone }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['timeZone'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'app',
        key: 'timeZone',
        valueJson: toJsonValue({ timeZone: config.timeZone }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['timeZone'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'app', key: 'uploadValidation' } },
      update: {
        valueJson: toJsonValue({ maxFileSizeMb: config.uploadMaxFileSizeMb }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['maxFileSizeMb'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'app',
        key: 'uploadValidation',
        valueJson: toJsonValue({ maxFileSizeMb: config.uploadMaxFileSizeMb }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['maxFileSizeMb'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'app', key: 'featureFlags' } },
      update: {
        valueJson: toJsonValue({ flags }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['flags'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'app',
        key: 'featureFlags',
        valueJson: toJsonValue({ flags }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['flags'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'feature', key: 'mealDraftReview' } },
      update: {
        valueJson: toJsonValue({ enabled: config.mealDraftReviewEnabled, rolloutPercentage: config.mealDraftReviewRolloutPercentage }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['enabled', 'rolloutPercentage'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
      create: {
        namespace: 'feature',
        key: 'mealDraftReview',
        valueJson: toJsonValue({ enabled: config.mealDraftReviewEnabled, rolloutPercentage: config.mealDraftReviewRolloutPercentage }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['enabled', 'rolloutPercentage'] }),
        version,
        publishedAt,
        publishedBy: actorId,
      },
    }),
  ]);

  return {
    ...config,
    experimentalFeatureFlags: flags,
  };
}

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const [config, changes] = await Promise.all([loadCurrentAppSettingsConfig(), loadRecentChanges()]);

  return withCsrfToken(
    request,
    {
      ok: true,
      config,
      defaults: getDefaults(),
      exportConfig: {
        appName: config.appName,
        supportEmail: config.supportEmail,
        timeZone: config.timeZone,
        uploadMaxFileSizeMb: config.uploadMaxFileSizeMb,
        experimentalFeatureFlags: config.experimentalFeatureFlags,
        mealDraftReviewEnabled: config.mealDraftReviewEnabled,
        mealDraftReviewRolloutPercentage: config.mealDraftReviewRolloutPercentage,
      },
      changes,
      permissions: {
        canWrite: isSuperAdminRole(guard.user.role),
      },
    },
    { status: 200 },
  );
}

export async function PUT(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  return withAdminWriteProtection(request, guard.user.id, async () => {
    const parsed = appSettingsSchema.safeParse(await getJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ message: 'Geçersiz uygulama ayarları.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const current = await loadCurrentAppSettingsConfig();
    const nextVersion = current.version + 1;
    const published = await publishAppSettings(parsed.data, guard.user.id, nextVersion);

    await createAdminAuditLog({
      actorId: guard.user.id,
      action: 'app_settings_updated',
      resourceType: 'app_meta',
      resourceKey: 'app.settings',
      beforeJson: toJsonValue(current),
      afterJson: toJsonValue({ ...published, version: nextVersion }),
      request,
    });

    return NextResponse.json({ ok: true, config: { ...published, version: nextVersion } }, { status: 200 });
  });
}

export async function DELETE(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  return withAdminWriteProtection(request, guard.user.id, async () => {
    const current = await loadCurrentAppSettingsConfig();
    const defaults = getDefaults();
    const nextVersion = current.version + 1;
    const published = await publishAppSettings(defaults, guard.user.id, nextVersion);

    await createAdminAuditLog({
      actorId: guard.user.id,
      action: 'app_settings_reset',
      resourceType: 'app_meta',
      resourceKey: 'app.settings',
      beforeJson: toJsonValue(current),
      afterJson: toJsonValue({ ...published, version: nextVersion }),
      request,
    });

    return NextResponse.json({ ok: true, config: { ...published, version: nextVersion } }, { status: 200 });
  });
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  return withAdminWriteProtection(request, guard.user.id, async () => {
    const parsedBody = z.object({ config: appSettingsSchema }).safeParse(await getJsonBody(request));

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'İçe aktarma verisi geçersiz.', issues: parsedBody.error.flatten() }, { status: 400 });
    }

    const current = await loadCurrentAppSettingsConfig();
    const nextVersion = current.version + 1;
    const published = await publishAppSettings(parsedBody.data.config, guard.user.id, nextVersion);

    await createAdminAuditLog({
      actorId: guard.user.id,
      action: 'app_settings_imported',
      resourceType: 'app_meta',
      resourceKey: 'app.settings',
      beforeJson: toJsonValue(current),
      afterJson: toJsonValue({ ...published, version: nextVersion }),
      request,
    });

    return NextResponse.json({ ok: true, config: { ...published, version: nextVersion } }, { status: 200 });
  });
}
