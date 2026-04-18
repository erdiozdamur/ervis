import { existsSync, readFileSync } from 'node:fs';

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const source = readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function isPresent(value) {
  return Boolean(value && value.trim().length > 0);
}

export function getFirst(keys, source = process.env) {
  for (const key of keys) {
    if (isPresent(source[key])) {
      return source[key];
    }
  }

  return undefined;
}

export function isEnabled(raw, defaultValue = true) {
  if (typeof raw !== 'string') {
    return defaultValue;
  }

  const value = raw.trim().toLowerCase();

  if (value === 'false' || value === '0' || value === 'no') {
    return false;
  }

  if (value === 'true' || value === '1' || value === 'yes') {
    return true;
  }

  return defaultValue;
}

export function loadRuntimeEnv(mode = process.env.NODE_ENV ?? 'development') {
  const protectedKeys = new Set(Object.keys(process.env));
  const layeredValues = {};
  const envFiles = ['.env', `.env.${mode}`];

  if (mode !== 'test') {
    envFiles.push('.env.local');
  }

  envFiles.push(`.env.${mode}.local`);

  for (const filePath of envFiles) {
    const nextValues = parseEnvFile(filePath);

    for (const [key, value] of Object.entries(nextValues)) {
      layeredValues[key] = value;
    }
  }

  for (const [key, value] of Object.entries(layeredValues)) {
    if (!protectedKeys.has(key)) {
      process.env[key] = value;
    }
  }
}

export function applyCommonEnvAliases(source = process.env) {
  const resolvedDatabaseUrl = getFirst(['DATABASE_URL'], source);
  const resolvedAuthSecret = getFirst(['AUTH_SECRET', 'NEXTAUTH_SECRET', 'JWT_SECRET_KEY'], source);
  const resolvedAppUrl = getFirst(['AUTH_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL'], source);
  const resolvedGoogleClientId = getFirst(['AUTH_GOOGLE_ID', 'GOOGLE_CLIENT_ID'], source);
  const resolvedGoogleClientSecret = getFirst(['AUTH_GOOGLE_SECRET', 'GOOGLE_CLIENT_SECRET'], source);

  if (resolvedDatabaseUrl) {
    source.DATABASE_URL = resolvedDatabaseUrl;
  }

  if (resolvedAuthSecret) {
    source.AUTH_SECRET = resolvedAuthSecret;
    source.NEXTAUTH_SECRET = resolvedAuthSecret;
  }

  if (resolvedAppUrl) {
    source.AUTH_URL = resolvedAppUrl;
    source.NEXTAUTH_URL = resolvedAppUrl;
    source.NEXT_PUBLIC_APP_URL = source.NEXT_PUBLIC_APP_URL ?? resolvedAppUrl;
  }

  if (resolvedGoogleClientId) {
    source.GOOGLE_CLIENT_ID = resolvedGoogleClientId;
    source.AUTH_GOOGLE_ID = resolvedGoogleClientId;
  }

  if (resolvedGoogleClientSecret) {
    source.GOOGLE_CLIENT_SECRET = resolvedGoogleClientSecret;
    source.AUTH_GOOGLE_SECRET = resolvedGoogleClientSecret;
  }

  return {
    resolvedDatabaseUrl,
    resolvedAuthSecret,
    resolvedAppUrl,
    resolvedGoogleClientId,
    resolvedGoogleClientSecret,
  };
}
