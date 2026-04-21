import { prisma } from '@/db/prisma';
import { getServerEnv } from '@/lib/env';
import { ADMIN_MANAGED_SECRET_KEYS, type AdminManagedSecretKey, type SecretSource } from '@/lib/secrets/secret-catalog';

type SecretMetaRecord = {
  configured: boolean;
  source: SecretSource;
  lastRotatedAt: string | null;
};

type StoredSecretMetaRecord = {
  source?: SecretSource;
  lastRotatedAt?: string;
};

export type SecretAdminStatus = {
  key: AdminManagedSecretKey;
  configured: boolean;
  source: SecretSource;
  lastRotatedAt: string | null;
};

export function getSecretMetaKey(secretKey: AdminManagedSecretKey) {
  return `secret.meta.${secretKey}`;
}

function readConfiguredFromEnv(secretKey: AdminManagedSecretKey): boolean {
  const env = getServerEnv();
  return Boolean(env[secretKey]);
}

function mergeMeta(secretKey: AdminManagedSecretKey, storedMeta?: StoredSecretMetaRecord | null): SecretMetaRecord {
  const configured = readConfiguredFromEnv(secretKey);

  return {
    configured,
    source: storedMeta?.source === 'secret_manager' ? 'secret_manager' : 'env',
    lastRotatedAt: storedMeta?.lastRotatedAt ?? null,
  };
}

export async function getAdminSecretStatuses(): Promise<SecretAdminStatus[]> {
  const keys = ADMIN_MANAGED_SECRET_KEYS.map(getSecretMetaKey);
  const rows = await prisma.appMeta.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });
  const rowMap = new Map(rows.map((row) => [row.key, row.value]));

  return ADMIN_MANAGED_SECRET_KEYS.map((secretKey) => {
    const rawMeta = rowMap.get(getSecretMetaKey(secretKey));
    const storedMeta = rawMeta ? (JSON.parse(rawMeta) as StoredSecretMetaRecord) : null;
    const merged = mergeMeta(secretKey, storedMeta);
    return {
      key: secretKey,
      configured: merged.configured,
      source: merged.source,
      lastRotatedAt: merged.lastRotatedAt,
    };
  });
}

export async function getAdminSecretStatusesSafe(): Promise<SecretAdminStatus[]> {
  try {
    return await getAdminSecretStatuses();
  } catch {
    return ADMIN_MANAGED_SECRET_KEYS.map((secretKey) => ({
      key: secretKey,
      configured: readConfiguredFromEnv(secretKey),
      source: 'env',
      lastRotatedAt: null,
    }));
  }
}

export async function upsertSecretMeta(secretKey: AdminManagedSecretKey, payload: { source: SecretSource; rotatedAt: Date }) {
  const configured = readConfiguredFromEnv(secretKey);
  const value = JSON.stringify({
    source: payload.source,
    configured,
    lastRotatedAt: payload.rotatedAt.toISOString(),
  });

  await prisma.appMeta.upsert({
    where: {
      key: getSecretMetaKey(secretKey),
    },
    update: {
      value,
    },
    create: {
      key: getSecretMetaKey(secretKey),
      value,
    },
  });
}

export async function appendSecretRotationAudit(input: {
  secretKey: AdminManagedSecretKey;
  actorUserId: string;
  actorEmail: string;
  source: SecretSource;
  note: string | null;
  happenedAt: Date;
}) {
  await prisma.secretRotationAudit.create({
    data: {
      secretKey: input.secretKey,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      source: input.source,
      note: input.note,
      happenedAt: input.happenedAt,
    },
  });
}
