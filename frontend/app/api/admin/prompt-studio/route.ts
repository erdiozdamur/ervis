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

type PromptStudioDraftInput = z.infer<typeof promptStudioSchema>;
type SecretStatus = 'configured' | 'not configured';

const promptVersionPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

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
        in: ['prompt_studio_updated', 'prompt_studio_tested', 'prompt_studio_rollback'],
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

function validatePromptStudioInput(input: PromptStudioDraftInput) {
  const issues: string[] = [];

  if (input.provider.length > 64 || input.model.length > 128 || input.promptVersion.length > 64) {
    issues.push('Alanlardan biri beklenen uzunluk sınırını aşıyor.');
  }

  if (!promptVersionPattern.test(input.promptVersion)) {
    issues.push('Prompt version yalnızca küçük harf, rakam ve ._- ayraçları içerebilir.');
  }

  if (!input.promptVersion.includes('-v')) {
    issues.push("Prompt version içinde sürüm eki bekleniyor (örn: 'meal-intake-v3').");
  }

  const hasPlaceholder = /\{\{\s*input\s*\}\}/.test(input.promptVersion);
  if (hasPlaceholder) {
    issues.push('Prompt version içinde template placeholder kullanılmamalı.');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

async function runPromptStudioSmokeTest(expected: PromptStudioDraftInput) {
  const latest = await loadCurrentPromptStudioConfig();
  const checks = [
    {
      step: 'published_values_match',
      ok: latest.provider === expected.provider && latest.model === expected.model && latest.promptVersion === expected.promptVersion,
      detail: 'Yayınlanan değerler geri okunup karşılaştırıldı.',
    },
    {
      step: 'non_empty_effective_values',
      ok: latest.provider.trim().length > 0 && latest.model.trim().length > 0 && latest.promptVersion.trim().length > 0,
      detail: 'Etkin provider/model/promptVersion boş değil.',
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export async function GET() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const env = getServerEnv();
  const [config, changes] = await Promise.all([loadCurrentPromptStudioConfig(), loadRecentChanges()]);
  const latestUpdate = changes.find((change) => change.action === 'prompt_studio_updated');
  const previousConfig =
    latestUpdate && latestUpdate.beforeJson && typeof latestUpdate.beforeJson === 'object'
      ? (latestUpdate.beforeJson as Partial<PromptStudioDraftInput> & { version?: number })
      : null;

  const secretStatus: { openaiApiKey: SecretStatus } = {
    openaiApiKey: env.OPENAI_API_KEY ? 'configured' : 'not configured',
  };

  return NextResponse.json({ ok: true, config, previousConfig, changes, secretStatus }, { status: 200 });
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
  const contentValidation = validatePromptStudioInput(parsed.data);

  if (!contentValidation.ok) {
    return NextResponse.json({ message: 'Prompt doğrulaması başarısız oldu.', warnings: contentValidation.issues }, { status: 400 });
  }

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

  const contentValidation = validatePromptStudioInput(parsed.data);
  if (!contentValidation.ok) {
    return NextResponse.json({ message: 'Prompt doğrulaması başarısız oldu.', issues: contentValidation.issues }, { status: 400 });
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

  const smokeTest = await runPromptStudioSmokeTest(parsed.data);

  return NextResponse.json({ ok: true, version: nextVersion, smokeTest }, { status: 200 });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const latestUpdate = await prisma.adminAuditLog.findFirst({
    where: {
      resourceType: 'app_meta',
      resourceKey: 'ai.promptStudio',
      action: 'prompt_studio_updated',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latestUpdate?.beforeJson || typeof latestUpdate.beforeJson !== 'object') {
    return NextResponse.json({ message: 'Rollback için uygun önceki sürüm bulunamadı.' }, { status: 400 });
  }

  const rollbackTarget = promptStudioSchema.safeParse(latestUpdate.beforeJson);
  if (!rollbackTarget.success) {
    return NextResponse.json({ message: 'Rollback verisi bozuk veya eksik.' }, { status: 400 });
  }

  const current = await loadCurrentPromptStudioConfig();
  const nextVersion = current.version + 1;
  const publishedAt = new Date();

  await prisma.$transaction([
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'provider' } },
      update: {
        valueJson: toJsonValue({ provider: rollbackTarget.data.provider }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['provider'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'provider',
        valueJson: toJsonValue({ provider: rollbackTarget.data.provider }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['provider'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'mealModel' } },
      update: {
        valueJson: toJsonValue({ model: rollbackTarget.data.model, temperature: 0.2 }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['model', 'temperature'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'mealModel',
        valueJson: toJsonValue({ model: rollbackTarget.data.model, temperature: 0.2 }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['model', 'temperature'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
    prisma.appMeta.upsert({
      where: { namespace_key: { namespace: 'ai', key: 'analysisPromptVersion' } },
      update: {
        valueJson: toJsonValue({ version: rollbackTarget.data.promptVersion }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['version'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
      create: {
        namespace: 'ai',
        key: 'analysisPromptVersion',
        valueJson: toJsonValue({ version: rollbackTarget.data.promptVersion }),
        valueSchemaJson: toJsonValue({ type: 'object', required: ['version'] }),
        version: nextVersion,
        publishedAt,
        publishedBy: guard.user.id,
      },
    }),
  ]);

  await createAdminAuditLog({
    actorId: guard.user.id,
    action: 'prompt_studio_rollback',
    resourceType: 'app_meta',
    resourceKey: 'ai.promptStudio',
    beforeJson: toJsonValue(current),
    afterJson: toJsonValue({ ...rollbackTarget.data, version: nextVersion }),
    request,
  });

  return NextResponse.json({ ok: true, version: nextVersion, restored: rollbackTarget.data }, { status: 200 });
}
