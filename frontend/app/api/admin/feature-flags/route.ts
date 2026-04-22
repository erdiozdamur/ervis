import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { isSuperAdminRole, requireAdmin, requireSuperAdmin } from '@/lib/auth/admin';
import { withAdminWriteProtection, withCsrfToken } from '@/lib/security/admin-write-guard';

const featureFlagsSchema = z.object({
  flags: z.array(z.string().trim().min(1).max(64)).max(200),
});

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeFlags(flags: string[]) {
  return Array.from(new Set(flags.map((flag) => flag.trim().toLowerCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function readCurrentFlags() {
  const row = await prisma.appMeta.findUnique({
    where: {
      namespace_key: {
        namespace: 'app',
        key: 'featureFlags',
      },
    },
    select: {
      valueJson: true,
      version: true,
      publishedBy: true,
      publishedAt: true,
    },
  });

  const flags = normalizeFlags((row?.valueJson as { flags?: string[] } | null)?.flags ?? []);

  return {
    flags,
    version: row?.version ?? 1,
    publishedBy: row?.publishedBy ?? null,
    publishedAt: row?.publishedAt ?? null,
  };
}

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const config = await readCurrentFlags();

  return withCsrfToken(
    request,
    {
      ok: true,
      config,
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
    const parsedBody = featureFlagsSchema.safeParse(await getJsonBody(request));
    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Özellik bayrağı verisi geçersiz.', issues: parsedBody.error.flatten() }, { status: 400 });
    }

    const current = await readCurrentFlags();
    const flags = normalizeFlags(parsedBody.data.flags);
    const nextVersion = current.version + 1;
    const publishedAt = new Date();

    await prisma.appMeta.upsert({
      where: {
        namespace_key: {
          namespace: 'app',
          key: 'featureFlags',
        },
      },
      update: {
        valueJson: toJsonValue({ flags }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['flags'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'app',
        key: 'featureFlags',
        valueJson: toJsonValue({ flags }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['flags'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    });

    await createAdminAuditLog({
      actorId: guard.user.id,
      action: 'feature_flags_updated',
      resourceType: 'app_meta',
      resourceKey: 'app.featureFlags',
      beforeJson: toJsonValue(current),
      afterJson: toJsonValue({ flags, version: nextVersion }),
      request,
    });

    return NextResponse.json({ ok: true, config: { flags, version: nextVersion } }, { status: 200 });
  });
}
