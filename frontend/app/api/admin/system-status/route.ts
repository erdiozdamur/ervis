import { NextResponse } from 'next/server';
import { prisma } from '@/db/prisma';
import { requireAdmin } from '@/lib/auth/admin';
import { getRuntimeEnvChecks, getServerEnv } from '@/lib/env';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }

  const env = getServerEnv();
  const runtimeChecks = getRuntimeEnvChecks();

  let database: { ok: boolean; latencyMs: number | null; error: string | null } = {
    ok: true,
    latencyMs: null,
    error: null,
  };

  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = {
      ok: true,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    database = {
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Veritabanı bağlantısı başarısız.',
    };
  }

  const runtimeRows = [
    { key: 'databaseConfigured', ok: runtimeChecks.databaseConfigured, message: 'DATABASE_URL tanımlı olmalı.' },
    { key: 'authSecretConfigured', ok: runtimeChecks.authSecretConfigured, message: 'AUTH_SECRET tanımlı olmalı.' },
    { key: 'authUrlConfigured', ok: runtimeChecks.authUrlConfigured, message: 'NEXTAUTH_URL veya NEXT_PUBLIC_APP_URL gerekli.' },
  ];

  return NextResponse.json({
    ok: true,
    status: database.ok && runtimeRows.every((check) => check.ok) ? 'ok' : 'degraded',
    generatedAt: new Date().toISOString(),
    checks: {
      database,
      runtime: runtimeRows,
      secrets: {
        OPENAI_API_KEY: env.OPENAI_API_KEY ? 'tanimli' : 'tanimli_degil',
      },
    },
  });
}
