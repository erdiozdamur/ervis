import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';

function isPresent(value) {
  return Boolean(value && value.trim().length > 0);
}

function getFirst(keys) {
  for (const key of keys) {
    if (isPresent(process.env[key])) return process.env[key];
  }
  return undefined;
}

function resolveDatabaseUrl() {
  const direct = getFirst(['DATABASE_URL']);
  if (direct) return direct;

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;
  const host = process.env.POSTGRES_HOST ?? 'postgres';
  const port = process.env.POSTGRES_PORT ?? '5432';

  if (isPresent(user) && isPresent(password) && isPresent(database)) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  return undefined;
}

const resolvedPort = process.env.PORT ?? '3000';
const resolvedDatabaseUrl = resolveDatabaseUrl();
const resolvedNextAuthSecret = getFirst(['AUTH_SECRET', 'NEXTAUTH_SECRET', 'JWT_SECRET_KEY']);
const resolvedAuthUrl = getFirst(['AUTH_URL', 'NEXTAUTH_URL']);
const resolvedGoogleClientId = getFirst(['AUTH_GOOGLE_ID', 'GOOGLE_CLIENT_ID']);
const resolvedGoogleClientSecret = getFirst(['AUTH_GOOGLE_SECRET', 'GOOGLE_CLIENT_SECRET']);
const hasGoogleProvider = isPresent(resolvedGoogleClientId) && isPresent(resolvedGoogleClientSecret);

if (resolvedDatabaseUrl) process.env.DATABASE_URL = resolvedDatabaseUrl;
if (resolvedNextAuthSecret) {
  process.env.NEXTAUTH_SECRET = resolvedNextAuthSecret;
  process.env.AUTH_SECRET = resolvedNextAuthSecret;
}
if (resolvedAuthUrl) {
  process.env.NEXTAUTH_URL = resolvedAuthUrl;
  process.env.AUTH_URL = resolvedAuthUrl;
}
if (resolvedGoogleClientId) {
  process.env.GOOGLE_CLIENT_ID = resolvedGoogleClientId;
  process.env.AUTH_GOOGLE_ID = resolvedGoogleClientId;
}
if (resolvedGoogleClientSecret) {
  process.env.GOOGLE_CLIENT_SECRET = resolvedGoogleClientSecret;
  process.env.AUTH_GOOGLE_SECRET = resolvedGoogleClientSecret;
}
process.env.PORT = resolvedPort;

console.log('[startup] command: next start -H 0.0.0.0 -p 3000');
console.log(`[startup] cwd: ${process.cwd()}`);
console.log(`[startup] port: ${resolvedPort} (Next.js is started on 3000 explicitly)`);
console.log(`[startup] next binary: ${process.cwd()}/node_modules/.bin/next`);
console.log(`[startup] required env DATABASE_URL: ${resolvedDatabaseUrl ? 'present' : 'missing'}`);
console.log(`[startup] required env AUTH_SECRET/NEXTAUTH_SECRET/JWT_SECRET_KEY: ${resolvedNextAuthSecret ? 'present' : 'missing'}`);
console.log(`[startup] optional env AUTH_URL/NEXTAUTH_URL: ${resolvedAuthUrl ? 'present' : 'missing'}`);
console.log(`[startup] optional env ADMIN_EMAIL: ${isPresent(process.env.ADMIN_EMAIL) ? 'present' : 'missing'}`);
console.log(`[startup] optional google provider envs: ${hasGoogleProvider ? 'present' : 'missing (Google auth disabled)'}`);

const missingRequired = [];
if (!resolvedDatabaseUrl) missingRequired.push('DATABASE_URL or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB');
if (!resolvedNextAuthSecret) missingRequired.push('AUTH_SECRET or NEXTAUTH_SECRET or JWT_SECRET_KEY');

if (missingRequired.length > 0) {
  console.error(`[startup] Missing required environment variable(s): ${missingRequired.join(', ')}`);
  process.exit(1);
}

console.log('[startup] running Prisma migrations: npx prisma migrate deploy');
const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
if (migrateResult.status !== 0) {
  process.exit(migrateResult.status ?? 1);
}

const child = spawn('node_modules/.bin/next', ['start', '-H', '0.0.0.0', '-p', '3000'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
