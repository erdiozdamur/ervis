import { spawnSync } from 'node:child_process';
import { applyCommonEnvAliases, isEnabled, loadRuntimeEnv } from './env-bootstrap.mjs';

const TRANSITIONAL_AUTH_MODEL_NAMES = new Set([
  'Account',
  'Session',
  'User',
  'VerificationToken',
]);

const BLOCKING_LEGACY_MODEL_NAMES = new Set([
  'AuditLog',
  'Capability',
  'ContextSource',
  'Employee',
  'EmployeeCapability',
  'EmployeeEdge',
  'Organization',
  'Team',
  'TeamCapability',
  'TeamEdge',
]);

loadRuntimeEnv(process.env.NODE_ENV ?? 'development');
applyCommonEnvAliases(process.env);

function runPrisma(args, options = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    stdio: options.stdin ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input: options.stdin,
    env: process.env,
  });
  return result.status ?? 1;
}

function runPrismaCapture(args) {
  return spawnSync('npx', ['prisma', ...args], {
    env: process.env,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function extractModelNames(schemaSource) {
  const names = [];
  const pattern = /^model\s+([A-Za-z_][A-Za-z0-9_]*)\s+\{/gm;
  let match;

  while ((match = pattern.exec(schemaSource)) !== null) {
    names.push(match[1]);
  }

  return names;
}

function isEmptyDatabasePull(result) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return combinedOutput.includes('P4001') || combinedOutput.includes('The introspected database was empty');
}

function resetPublicSchema() {
  console.warn('[migrator] Running destructive schema reset (DROP/CREATE public schema).');
  const resetSql = `DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n`;
  const status = runPrisma(['db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], { stdin: resetSql });
  if (status !== 0) {
    console.error('[migrator] Failed to reset schema using prisma db execute.');
    process.exit(status);
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[migrator] DATABASE_URL is required.');
  process.exit(1);
}

const allowDestructiveReset = isEnabled(process.env.ALLOW_DESTRUCTIVE_BASELINE_RESET, false);

console.log('[migrator] Inspecting database schema for legacy models...');
const introspection = runPrismaCapture(['db', 'pull', '--print', '--schema', 'prisma/schema.prisma']);
if ((introspection.status ?? 1) !== 0) {
  if (isEmptyDatabasePull(introspection)) {
    console.log('[migrator] Database is empty; continuing with migration deploy.');
  } else {
  if (introspection.stdout) process.stdout.write(introspection.stdout);
  if (introspection.stderr) process.stderr.write(introspection.stderr);
  console.error('[migrator] Schema introspection failed.');
  process.exit(introspection.status ?? 1);
  }
}

const discoveredModels = (introspection.status ?? 1) === 0 ? extractModelNames(introspection.stdout ?? '') : [];
const blockingLegacyModels = discoveredModels.filter((name) => BLOCKING_LEGACY_MODEL_NAMES.has(name));
const transitionalAuthModels = discoveredModels.filter((name) => TRANSITIONAL_AUTH_MODEL_NAMES.has(name));
const hasPartialAuthSchema = blockingLegacyModels.length === 0 && transitionalAuthModels.length > 0;

if (blockingLegacyModels.length > 0) {
  if (!allowDestructiveReset) {
    console.error(
      `[migrator] Legacy schema detected (${blockingLegacyModels.join(', ')}) but ALLOW_DESTRUCTIVE_BASELINE_RESET is disabled.`,
    );
    console.error(
      '[migrator] For local development, run `npm run db:reset:local`, then `npm run db:start` and `npm run db:migrate:deploy`.',
    );
    process.exit(1);
  }

  console.warn(`[migrator] Legacy schema detected: ${blockingLegacyModels.join(', ')}.`);
  resetPublicSchema();
}

if (hasPartialAuthSchema) {
  console.warn(
    `[migrator] Found transitional auth tables (${transitionalAuthModels.join(
      ', ',
    )}). Proceeding with migrate deploy so a partial local auth schema can be completed safely.`,
  );
}

console.log('[migrator] Running Prisma migrate deploy...');
let status = runPrisma(['migrate', 'deploy']);

if (status === 0) {
  console.log('[migrator] Prisma migrate deploy completed successfully.');
  process.exit(0);
}

if (!allowDestructiveReset) {
  if (hasPartialAuthSchema) {
    console.error(
      '[migrator] migrate deploy failed against a partial local auth schema. Run `npm run db:reset:local`, then `npm run db:start` and `npm run db:migrate:deploy`.',
    );
  } else {
    console.error('[migrator] migrate deploy failed and ALLOW_DESTRUCTIVE_BASELINE_RESET is disabled.');
  }
  process.exit(status);
}

console.warn('[migrator] migrate deploy failed; running destructive baseline reset fallback.');
resetPublicSchema();

console.log('[migrator] Re-running Prisma migrate deploy after schema reset...');
status = runPrisma(['migrate', 'deploy']);
if (status !== 0) {
  console.error('[migrator] migrate deploy failed after destructive reset.');
  process.exit(status);
}

console.log('[migrator] Baseline reset and migration deploy completed.');
