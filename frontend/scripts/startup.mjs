import { spawn, spawnSync } from 'node:child_process';
import { applyCommonEnvAliases, getFirst, isEnabled, isPresent, loadRuntimeEnv } from './env-bootstrap.mjs';

loadRuntimeEnv(process.env.NODE_ENV ?? 'production');

const resolvedPort = process.env.PORT ?? '3000';
const { resolvedDatabaseUrl, resolvedAuthSecret, resolvedGoogleClientId, resolvedGoogleClientSecret } =
  applyCommonEnvAliases(process.env);
const hasGoogleProvider = isPresent(resolvedGoogleClientId) && isPresent(resolvedGoogleClientSecret);
const normalizedNodeEnv = process.env.NODE_ENV ?? 'production';
const resolvedPublicAppUrl = getFirst(['NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL', 'AUTH_URL']);

process.env.PORT = resolvedPort;
process.env.NODE_ENV = normalizedNodeEnv;

if (!resolvedPublicAppUrl && normalizedNodeEnv !== 'production') {
  const fallbackLocalUrl = `http://localhost:${resolvedPort}`;
  process.env.NEXT_PUBLIC_APP_URL = fallbackLocalUrl;
  process.env.NEXTAUTH_URL = fallbackLocalUrl;
  process.env.AUTH_URL = fallbackLocalUrl;
}

function isPlaceholderSecret(value) {
  if (!isPresent(value)) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.includes('replace-with') || normalized.includes('changeme') || value.trim().length < 24;
}

function validateStartupEnvironment() {
  const errors = [];
  const warnings = [];
  const runtimeAppUrl = getFirst(['NEXTAUTH_URL', 'AUTH_URL', 'NEXT_PUBLIC_APP_URL']);
  const trustsForwardedHost = isEnabled(process.env.AUTH_TRUST_HOST, true);

  if (!resolvedDatabaseUrl) {
    const message = 'DATABASE_URL is missing.';
    if (normalizedNodeEnv === 'production') {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (!resolvedAuthSecret) {
    const message = 'AUTH_SECRET (or NEXTAUTH_SECRET) is missing.';
    if (normalizedNodeEnv === 'production') {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  } else if (normalizedNodeEnv === 'production' && isPlaceholderSecret(resolvedAuthSecret)) {
    errors.push('AUTH_SECRET looks like a placeholder or is too short for production.');
  }

  if (!runtimeAppUrl) {
    const message = trustsForwardedHost
      ? 'NEXTAUTH_URL/NEXT_PUBLIC_APP_URL is not set. Startup will rely on AUTH_TRUST_HOST and forwarded host headers.'
      : 'NEXTAUTH_URL or NEXT_PUBLIC_APP_URL is required to build auth callback URLs.';
    if (normalizedNodeEnv === 'production' && !trustsForwardedHost) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return { errors, warnings };
}

function waitForDatabase() {
  const waitTimeoutMs = Number(process.env.STARTUP_DB_WAIT_TIMEOUT_MS ?? '60000');
  const waitIntervalMs = Number(process.env.STARTUP_DB_WAIT_INTERVAL_MS ?? '2000');
  const deadline = Date.now() + waitTimeoutMs;

  console.log(`[startup] waiting for database connectivity for up to ${waitTimeoutMs}ms...`);

  while (Date.now() <= deadline) {
    const probe = spawnSync(
      'npx',
      ['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'],
      {
        stdio: ['pipe', 'ignore', 'ignore'],
        input: 'SELECT 1;',
        env: process.env,
      },
    );

    if ((probe.status ?? 1) === 0) {
      console.log('[startup] database connectivity confirmed.');
      return;
    }

    const sleepUntil = Date.now() + waitIntervalMs;
    while (Date.now() < sleepUntil) {
      // Busy wait keeps the script dependency-free inside the slim runtime image.
    }
  }

  console.error(`[startup] database did not become reachable within ${waitTimeoutMs}ms.`);
  process.exit(1);
}

const startupValidation = validateStartupEnvironment();

console.log(`[startup] command: next start -H 0.0.0.0 -p ${resolvedPort}`);
console.log(`[startup] cwd: ${process.cwd()}`);
console.log(`[startup] node env: ${normalizedNodeEnv}`);
console.log(`[startup] port: ${resolvedPort}`);
console.log(`[startup] next binary: ${process.cwd()}/node_modules/.bin/next`);
console.log(`[startup] env DATABASE_URL: ${resolvedDatabaseUrl ? 'present' : 'missing'}`);
console.log(`[startup] env AUTH_SECRET/NEXTAUTH_SECRET: ${resolvedAuthSecret ? 'present' : 'missing'}`);
console.log(`[startup] env NEXTAUTH_URL/NEXT_PUBLIC_APP_URL: ${getFirst(['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL']) ? 'present' : 'missing'}`);
console.log(`[startup] optional google provider envs: ${hasGoogleProvider ? 'present' : 'missing (Google auth disabled)'}`);

for (const warning of startupValidation.warnings) {
  console.warn(`[startup] warning: ${warning}`);
}

if (startupValidation.errors.length > 0) {
  for (const error of startupValidation.errors) {
    console.error(`[startup] error: ${error}`);
  }

  process.exit(1);
}

const shouldRunMigrations = (process.env.APPLY_MIGRATIONS_ON_STARTUP ?? 'false').toLowerCase() === 'true';
const shouldWaitForDatabase = isEnabled(process.env.WAIT_FOR_DATABASE_ON_STARTUP, shouldRunMigrations || normalizedNodeEnv === 'production');

if (shouldWaitForDatabase && resolvedDatabaseUrl) {
  waitForDatabase();
}

if (shouldRunMigrations) {
  if (!resolvedDatabaseUrl) {
    console.error('[startup] APPLY_MIGRATIONS_ON_STARTUP=true requires DATABASE_URL.');
    process.exit(1);
  }

  console.log('[startup] APPLY_MIGRATIONS_ON_STARTUP=true; running Prisma migrations: npx prisma migrate deploy');
  const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
  });

  if (migrateResult.status !== 0) {
    console.error('[startup] Prisma migration deploy failed.');
    process.exit(migrateResult.status ?? 1);
  }
} else {
  console.log('[startup] APPLY_MIGRATIONS_ON_STARTUP is not true; skipping migrate deploy in app startup.');
}

const child = spawn('node_modules/.bin/next', ['start', '-H', '0.0.0.0', '-p', resolvedPort], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
