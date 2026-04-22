import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { DEFAULT_APP_TIME_ZONE } from '@/lib/config/app';
import { getServerEnv } from '@/lib/env';

type AppSettingsConfig = {
  timeZone: string;
  uploadMaxFileSizeMb: number;
  experimentalFeatureFlags: string[];
  version: number;
  lastPublishedBy: string | null;
};

const appSettingsSchema = z.object({
  timeZone: z.string().trim().min(1).max(120),
  uploadMaxFileSizeMb: z.coerce.number().positive().max(512),
  experimentalFeatureFlags: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
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

function getDefaults(): Pick<AppSettingsConfig, 'timeZone' | 'uploadMaxFileSizeMb' | 'experimentalFeatureFlags'> {
  const env = getServerEnv();

  return {
    timeZone: env.APP_TIME_ZONE ?? DEFAULT_APP_TIME_ZONE,
    uploadMaxFileSizeMb: env.MEAL_ASSET_MAX_FILE_SIZE_MB,
    experimentalFeatureFlags: [],
  };
}

async function loadCurrentAppSettingsConfig(): Promise<AppSettingsConfig> {
  const rows = await prisma.appMeta.findMany({
    where: {
      namespace: 'app',
      key: {
        in: ['timeZone', 'uploadValidation', 'featureFlags'],
      },
    },
    select: {
      key: true,
      valueJson: true,
      version: true,
      publishedBy: true,
    },
  });

  const defaults = getDefaults();
  const rowMap = new Map(rows.map((row) => [row.key, row]));

  return {
    timeZone: (rowMap.get('timeZone')?.valueJson as { timeZone?: string } | null)?.timeZone ?? defaults.timeZone,
    uploadMaxFileSizeMb:
      (rowMap.get('uploadValidation')?.valueJson as { maxFileSizeMb?: number } | null)?.maxFileSizeMb ??
      defaults.uploadMaxFileSizeMb,
    experimentalFeatureFlags: normalizeFlags(
      (rowMap.get('featureFlags')?.valueJson as { flags?: string[] } | null)?.flags ?? defaults.experimentalFeatureFlags,
    ),
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
      where: {
        namespace_key: {
          namespace: 'app',
          key: 'timeZone',
        },
      },
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
      where: {
        namespace_key: {
          namespace: 'app',
          key: 'uploadValidation',
        },
      },
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
      where: {
        namespace_key: {
          namespace: 'app',
          key: 'featureFlags',
        },
      },
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
  ]);

  return {
    ...config,
    experimentalFeatureFlags: flags,
  };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const [config, changes] = await Promise.all([loadCurrentAppSettingsConfig(), loadRecentChanges()]);

  return NextResponse.json(
    {
      ok: true,
      config,
      defaults: getDefaults(),
      exportConfig: {
        timeZone: config.timeZone,
        uploadMaxFileSizeMb: config.uploadMaxFileSizeMb,
        experimentalFeatureFlags: config.experimentalFeatureFlags,
      },
      changes,
    },
    { status: 200 },
  );
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const parsed = appSettingsSchema.safeParse(await getJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Geçersiz app ayarları.', issues: parsed.error.flatten() }, { status: 400 });
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
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

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
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = z
    .object({
      config: appSettingsSchema,
    })
    .safeParse(await getJsonBody(request));

  if (!parsedBody.success) {
    return NextResponse.json({ message: 'Import payload geçersiz.', issues: parsedBody.error.flatten() }, { status: 400 });
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
}
