import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
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

const CURRENT_MANAGED_TABLE_NAMES = new Set([
  'AppMeta',
  'auth_accounts',
  'auth_sessions',
  'auth_verification_tokens',
  'food_catalog_entries',
  'meal_analysis_runs',
  'meal_input_assets',
  'meal_items',
  'meals',
  'nutrition_cache_entries',
  'user_profiles',
  'users',
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

function listMigrationNames() {
  return readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function markAllMigrationsApplied() {
  const migrationNames = listMigrationNames();

  if (migrationNames.length === 0) {
    console.error('[migrator] No Prisma migrations were found to baseline.');
    process.exit(1);
  }

  console.warn(
    `[migrator] Current schema matches the managed app footprint but Prisma migration history is missing. Marking ${migrationNames.length} migrations as applied.`,
  );

  for (const migrationName of migrationNames) {
    const status = runPrisma(['migrate', 'resolve', '--applied', migrationName]);

    if (status !== 0) {
      console.error(`[migrator] Failed to mark migration ${migrationName} as applied.`);
      process.exit(status);
    }
  }
}

function isCurrentManagedSchemaWithoutHistory(tableNames) {
  const visibleTables = tableNames.filter((name) => name !== '_prisma_migrations');

  if (visibleTables.length !== CURRENT_MANAGED_TABLE_NAMES.size) {
    return false;
  }

  return visibleTables.every((tableName) => CURRENT_MANAGED_TABLE_NAMES.has(tableName));
}

async function inspectDatabaseState() {
  const prisma = new PrismaClient();

  try {
    const tableRows = await prisma.$queryRawUnsafe(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tableNames = tableRows.map((row) => row.tablename);
    const hasMigrationTable = tableNames.includes('_prisma_migrations');
    let failedMigrationNames = [];

    if (hasMigrationTable) {
      const migrationRows = await prisma.$queryRawUnsafe(`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at ASC
      `);

      failedMigrationNames = migrationRows
        .filter((row) => row.finished_at === null && row.rolled_back_at === null)
        .map((row) => row.migration_name);
    }

    return {
      tableNames,
      hasMigrationTable,
      failedMigrationNames,
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[migrator] DATABASE_URL is required.');
  process.exit(1);
}

const allowDestructiveReset = isEnabled(process.env.ALLOW_DESTRUCTIVE_BASELINE_RESET, false);

const databaseState = await inspectDatabaseState();

if (databaseState.tableNames.length === 0) {
  console.log('[migrator] No public tables detected before migration.');
} else {
  console.log(`[migrator] Existing public tables: ${databaseState.tableNames.join(', ')}`);
}

if (!databaseState.hasMigrationTable && isCurrentManagedSchemaWithoutHistory(databaseState.tableNames)) {
  markAllMigrationsApplied();
}

if (databaseState.failedMigrationNames.length > 0) {
  if (!allowDestructiveReset) {
    console.error(
      `[migrator] Found failed Prisma migration state (${databaseState.failedMigrationNames.join(
        ', ',
      )}) and ALLOW_DESTRUCTIVE_BASELINE_RESET is disabled.`,
    );
    console.error(
      '[migrator] This database likely came from a partially completed deploy. For disposable environments, set ALLOW_DESTRUCTIVE_BASELINE_RESET=true for one deploy or clear the Postgres volume.',
    );
    process.exit(1);
  }

  console.warn(
    `[migrator] Found failed Prisma migration state (${databaseState.failedMigrationNames.join(
      ', ',
    )}); resetting public schema because destructive reset is explicitly enabled.`,
  );
  resetPublicSchema();
}

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
