import { access, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getFirst, loadRuntimeEnv } from './env-bootstrap.mjs';

loadRuntimeEnv('development');

const resolvedPort = process.env.PORT ?? '3000';
const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, '.next');
const webpackRuntimePath = path.join(nextDir, 'server', 'webpack-runtime.js');
const vendorChunksDir = path.join(nextDir, 'server', 'vendor-chunks');

async function shouldResetNextArtifacts() {
  try {
    const runtime = await readFile(webpackRuntimePath, 'utf8');
    const referencesVendorChunks = runtime.includes('./vendor-chunks/');
    const vendorChunksPresent = await access(vendorChunksDir).then(
      () => true,
      () => false,
    );

    return referencesVendorChunks && !vendorChunksPresent;
  } catch {
    return false;
  }
}

if (!getFirst(['NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL', 'AUTH_URL'])) {
  const fallbackLocalUrl = `http://localhost:${resolvedPort}`;
  process.env.NEXT_PUBLIC_APP_URL = fallbackLocalUrl;
  process.env.NEXTAUTH_URL = fallbackLocalUrl;
  process.env.AUTH_URL = fallbackLocalUrl;
}

if (await shouldResetNextArtifacts()) {
  console.warn('[dev-start] detected stale .next output referencing missing vendor chunks; clearing .next.');
  await rm(nextDir, { recursive: true, force: true });
}

const child = spawn('node_modules/.bin/next', ['dev', '-H', '0.0.0.0', '-p', resolvedPort], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
