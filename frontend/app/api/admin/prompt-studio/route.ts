import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/db/prisma';
import { getJsonBody } from '@/lib/api/validation';
import { createAdminAuditLog } from '@/lib/auth/admin-audit';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerEnv } from '@/lib/env';

const promptStudioSchema = z.object({
  provider: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(128),
  promptVersion: z.string().trim().min(1).max(64),
});

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function loadCurrentPromptStudioConfig() {
  const rows = await prisma.appMeta.findMany({
    where: {
      namespace: 'ai',
      key: {
        in: ['provider', 'mealModel', 'analysisPromptVersion'],
      },
    },
    select: {
      key: true,
      valueJson: true,
      publishedBy: true,
      version: true,
    },
  });

  const rowMap = new Map(rows.map((row) => [row.key, row]));

  return {
    provider: (rowMap.get('provider')?.valueJson as { provider?: string } | null)?.provider ?? 'openai',
    model: (rowMap.get('mealModel')?.valueJson as { model?: string } | null)?.model ?? 'gpt-4.1-mini',
    promptVersion:
      (rowMap.get('analysisPromptVersion')?.valueJson as { version?: string } | null)?.version ?? 'meal-intake-v1',
    version: Math.max(...rows.map((row) => row.version), 1),
    lastPublishedBy: rows[0]?.publishedBy ?? null,
  };
}

async function loadRecentChanges() {
  return prisma.adminAuditLog.findMany({
    where: {
      resourceType: 'app_meta',
      resourceKey: 'ai.promptStudio',
      action: {
        in: ['prompt_studio_updated', 'prompt_studio_tested'],
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

export async function GET() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const [config, changes] = await Promise.all([loadCurrentPromptStudioConfig(), loadRecentChanges()]);

  return NextResponse.json({ ok: true, config, changes }, { status: 200 });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const parsed = promptStudioSchema.safeParse(await getJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json({ message: 'Geçersiz prompt ayarları.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const env = getServerEnv();
  const warnings: string[] = [];

  if (parsed.data.provider.toLowerCase() === 'openai' && !env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY bulunamadı. Test yalnızca şema doğrulaması ile tamamlandı.');
  }

  await createAdminAuditLog({
    actorId: guard.user.id,
    action: 'prompt_studio_tested',
    resourceType: 'app_meta',
    resourceKey: 'ai.promptStudio',
    beforeJson: Prisma.JsonNull,
    afterJson: toJsonValue({ ...parsed.data, warnings }),
    request,
  });

  return NextResponse.json(
    {
      ok: true,
      message: warnings.length ? 'Test uyarılarla tamamlandı.' : 'Test başarılı. Kaydetmeden önce doğrulama tamamlandı.',
      warnings,
    },
    { status: 200 },
  );
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const parsed = promptStudioSchema.safeParse(await getJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json({ message: 'Geçersiz prompt ayarları.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const current = await loadCurrentPromptStudioConfig();
  const nextVersion = current.version + 1;
  const publishedAt = new Date();

  await prisma.$transaction([
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'provider' } },
      update: {
        valueJson: toJsonValue({ provider: parsed.data.provider }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['provider'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'provider',
        valueJson: toJsonValue({ provider: parsed.data.provider }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['provider'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'mealModel' } },
      update: {
        valueJson: toJsonValue({ model: parsed.data.model, temperature: 0.2 }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['model', 'temperature'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'mealModel',
        valueJson: toJsonValue({ model: parsed.data.model, temperature: 0.2 }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['model', 'temperature'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'analysisPromptVersion' } },
      update: {
        valueJson: toJsonValue({ version: parsed.data.promptVersion }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['version'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'analysisPromptVersion',
        valueJson: toJsonValue({ version: parsed.data.promptVersion }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['version'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
  ]);

  await createAdminAuditLog({
    actorId: guard.user.id,
    action: 'prompt_studio_updated',
    resourceType: 'app_meta',
    resourceKey: 'ai.promptStudio',
    beforeJson: toJsonValue(current),
    afterJson: toJsonValue({ ...parsed.data, version: nextVersion }),
    request,
  });

  return NextResponse.json({ ok: true, version: nextVersion }, { status: 200 });
}
