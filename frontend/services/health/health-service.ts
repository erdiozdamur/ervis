import { APP_NAME } from '@/lib/config/app';
import { getAppDayKey } from '@/lib/date/istanbul';
import { getEffectiveConfig } from '@/lib/effective-config';
import { getRuntimeEnvChecks, getServerEnv } from '@/lib/env';
import type { HealthResponse } from '@/types/health';

export async function getHealthPayload(): Promise<HealthResponse> {
  const env = getServerEnv();
  const checks = getRuntimeEnvChecks();
  const effectiveConfig = await getEffectiveConfig();

  return {
    status: 'ok',
    service: APP_NAME,
    environment: env.APP_ENV ?? env.NODE_ENV,
    timeZone: effectiveConfig.appTimeZone,
    dayKey: getAppDayKey(new Date()),
    timestamp: new Date().toISOString(),
    checks,
  };
}
