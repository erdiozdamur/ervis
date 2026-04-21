import type { AdminManagedSecretKey, SecretSource } from '@/lib/secrets/secret-catalog';
import { appendSecretRotationAudit, upsertSecretMeta } from '@/services/secrets/secret-admin-service';

type RotateSecretInput = {
  key: AdminManagedSecretKey;
  value: string;
  actorUserId: string;
  actorEmail: string;
  note: string | null;
};

type SecretProvider = {
  rotateSecret: (input: { key: AdminManagedSecretKey; value: string }) => Promise<SecretSource>;
};

const envOnlyProvider: SecretProvider = {
  async rotateSecret() {
    throw new Error('Bu ortamda secret yazma işlemi yalnızca harici secret manager ile desteklenir.');
  },
};

const provider = envOnlyProvider;

export async function rotateSecretWithAudit(input: RotateSecretInput) {
  const rotatedAt = new Date();
  const source = await provider.rotateSecret({ key: input.key, value: input.value });

  await upsertSecretMeta(input.key, { source, rotatedAt });
  await appendSecretRotationAudit({
    secretKey: input.key,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    source,
    note: input.note,
    happenedAt: rotatedAt,
  });

  return {
    key: input.key,
    source,
    rotatedAt: rotatedAt.toISOString(),
  };
}
