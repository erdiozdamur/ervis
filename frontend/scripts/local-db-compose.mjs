import { spawnSync } from 'node:child_process';

const LOCAL_PROJECT_NAME = 'ervis-local';
const LEGACY_LOCAL_PROJECT_NAME = 'frontend';
const composeBaseArgs = ['compose', '-f', 'docker-compose.yml'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCompose(projectName, args) {
  run('docker', [...composeBaseArgs, '-p', projectName, ...args]);
}

function ensureLegacyProjectIsStopped() {
  console.log(`[local-db] Clearing legacy local compose project: ${LEGACY_LOCAL_PROJECT_NAME}`);
  runCompose(LEGACY_LOCAL_PROJECT_NAME, ['down', '--remove-orphans']);
}

function resetLegacyProjectVolumes() {
  console.log(`[local-db] Removing legacy local compose volumes: ${LEGACY_LOCAL_PROJECT_NAME}`);
  runCompose(LEGACY_LOCAL_PROJECT_NAME, ['down', '-v', '--remove-orphans']);
}

const action = process.argv[2];

switch (action) {
  case 'start':
    ensureLegacyProjectIsStopped();
    console.log(`[local-db] Starting local postgres via compose project: ${LOCAL_PROJECT_NAME}`);
    runCompose(LOCAL_PROJECT_NAME, ['up', '-d', 'postgres']);
    break;

  case 'stop':
    console.log(`[local-db] Stopping local postgres via compose project: ${LOCAL_PROJECT_NAME}`);
    runCompose(LOCAL_PROJECT_NAME, ['stop', 'postgres']);
    break;

  case 'logs':
    console.log(`[local-db] Streaming postgres logs via compose project: ${LOCAL_PROJECT_NAME}`);
    runCompose(LOCAL_PROJECT_NAME, ['logs', '-f', 'postgres']);
    break;

  case 'down':
    console.log(`[local-db] Removing local compose containers: ${LOCAL_PROJECT_NAME}`);
    runCompose(LOCAL_PROJECT_NAME, ['down', '--remove-orphans']);
    break;

  case 'reset':
    console.log(`[local-db] Resetting local compose stack and volumes: ${LOCAL_PROJECT_NAME}`);
    runCompose(LOCAL_PROJECT_NAME, ['down', '-v', '--remove-orphans']);
    resetLegacyProjectVolumes();
    break;

  default:
    console.error('[local-db] Usage: node ./scripts/local-db-compose.mjs <start|stop|logs|down|reset>');
    process.exit(1);
}
