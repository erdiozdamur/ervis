import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getServerEnv } from '@/lib/env';

function getStorageRootDir() {
  const { MEAL_ASSET_LOCAL_DIR } = getServerEnv();
  return path.isAbsolute(MEAL_ASSET_LOCAL_DIR) ? MEAL_ASSET_LOCAL_DIR : path.resolve(process.cwd(), MEAL_ASSET_LOCAL_DIR);
}

function normalizeStorageKey(storageKey: string) {
  const normalized = path.posix.normalize(storageKey).replace(/^\/+/, '');

  if (!normalized || normalized.startsWith('..')) {
    throw new Error('Invalid meal asset storage key.');
  }

  return normalized;
}

function resolveStoragePath(storageKey: string) {
  const normalizedStorageKey = normalizeStorageKey(storageKey);
  return path.join(getStorageRootDir(), ...normalizedStorageKey.split('/'));
}

export async function writeMealAssetFile(storageKey: string, data: Buffer) {
  const targetPath = resolveStoragePath(storageKey);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, data);
}

export async function readMealAssetFile(storageKey: string) {
  const filePath = resolveStoragePath(storageKey);
  return readFile(filePath);
}

export async function deleteMealAssetFile(storageKey: string) {
  const filePath = resolveStoragePath(storageKey);
  await unlink(filePath).catch(() => undefined);
}
