import { APP_NAME } from '@/lib/config/app';
import { getAppDayKey } from '@/lib/date/istanbul';
import { getRuntimeEnvChecks, getServerEnv } from '@/lib/env';
import type { HealthResponse } from '@/types/health';

export function getHealthPayload(): HealthResponse {
  const env = getServerEnv();
  const checks = getRuntimeEnvChecks();

  return {
    status: 'ok',
    service: APP_NAME,
    environment: env.NODE_ENV,
    timeZone: env.APP_TIME_ZONE,
    dayKey: getAppDayKey(new Date()),
    timestamp: new Date().toISOString(),
    checks,
  };
}
