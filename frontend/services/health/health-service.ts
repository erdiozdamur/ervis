import { APP_NAME } from '@/lib/config/app';
import { getAppDayKey } from '@/lib/date/istanbul';
import { getRuntimeEnvChecks, getServerEnv } from '@/lib/env';
import { getAdminSecretStatusesSafe } from '@/services/secrets/secret-admin-service';
import type { HealthResponse } from '@/types/health';

export async function getHealthPayload(): Promise<HealthResponse> {
  const env = getServerEnv();
  const checks = getRuntimeEnvChecks();
  const secretStatuses = await getAdminSecretStatusesSafe();
  const authSecretStatus = secretStatuses.find((item) => item.key === 'AUTH_SECRET');
  const openAiSecretStatus = secretStatuses.find((item) => item.key === 'OPENAI_API_KEY');

  return {
    status: 'ok',
    service: APP_NAME,
    environment: env.APP_ENV ?? env.NODE_ENV,
    timeZone: env.APP_TIME_ZONE,
    dayKey: getAppDayKey(new Date()),
    timestamp: new Date().toISOString(),
    checks: {
      ...checks,
      managedSecrets: {
        authSecret: {
          configured: authSecretStatus?.configured ?? checks.managedSecrets.authSecret.configured,
          source: authSecretStatus?.source ?? checks.managedSecrets.authSecret.source,
          lastRotatedAt: authSecretStatus?.lastRotatedAt ?? null,
        },
        openAiApiKey: {
          configured: openAiSecretStatus?.configured ?? checks.managedSecrets.openAiApiKey.configured,
          source: openAiSecretStatus?.source ?? checks.managedSecrets.openAiApiKey.source,
          lastRotatedAt: openAiSecretStatus?.lastRotatedAt ?? null,
        },
      },
    },
  };
}
